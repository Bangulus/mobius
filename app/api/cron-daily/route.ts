import { NextResponse } from 'next/server'
import {
  rpDecay,
  titleFromRp,
  titleRank,
  judgmentFromTrades,
  MOEBIUS_MIN_TITLE,
  MOEBIUS_MIN_JUDGMENT,
  MOEBIUS_MIN_TRADES,
} from '@/lib/progression'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

function isAuthorized(request: Request): boolean {
  const url         = new URL(request.url)
  const querySecret = url.searchParams.get('secret')
  const authHeader  = request.headers.get('authorization')
  const CRON_SECRET = process.env.CRON_SECRET!
  return authHeader === `Bearer ${CRON_SECRET}` || querySecret === CRON_SECRET
}

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    cache: 'no-store',
  })
  return res.json()
}

async function dbWrite(method: 'POST' | 'PATCH' | 'DELETE', table: string, filter: string, body?: object) {
  const url = filter ? `${SUPABASE_URL}/rest/v1/${table}?${filter}` : `${SUPABASE_URL}/rest/v1/${table}`
  const res = await fetch(url, {
    method,
    headers: {
      apikey:         SERVICE_KEY,
      Authorization:  `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res
}

// Heutiges Datum in Berliner Zeitzone als YYYY-MM-DD (gleiches Pattern wie lib/finnhub.ts: getDayMarketCloseISO)
function todayBerlin(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' })
}

// Differenz in ganzen Tagen zwischen zwei YYYY-MM-DD-Strings (identisch zu app/api/login-xp/route.ts)
function daysBetween(from: string, to: string): number {
  const fromMs = new Date(from + 'T00:00:00Z').getTime()
  const toMs   = new Date(to   + 'T00:00:00Z').getTime()
  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000))
}

// Erster und letzter Tag des Monats von "today" (YYYY-MM-DD), als YYYY-MM-DD.
function monthBounds(today: string): { start: string; end: string } {
  const [y, m] = today.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate() // Tag 0 des Folgemonats = letzter Tag dieses Monats
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

// ── Peak-Title fortschreiben ──────────────────────────────────
// users.peak_title (Lebenszeit-Bestwert, nie saisonal zurückgesetzt) wurde bisher
// nirgends im Code geschrieben — verifiziert per SQL-Stichprobe (13. Juli 2026,
// alle User auf 'Nadir'). Hebt peak_title an, wenn der aktuelle title-Rang höher
// ist als der gespeicherte peak_title-Rang. Läuft VOR dem RP-Verfall, damit ein
// durch Verfall in dieser Ausführung sinkender title den gerade erreichten
// Bestwert nicht verpasst.
async function updatePeakTitles() {
  const users: { id: string; title: string | null; peak_title: string | null }[] =
    await dbGet('users', `select=id,title,peak_title`)

  if (!users || users.length === 0) return { checked: 0, updated: 0 }

  let updated = 0
  for (const u of users) {
    const currentTitle = u.title ?? 'Nadir'
    const currentPeak  = u.peak_title ?? 'Nadir'
    if (titleRank(currentTitle) > titleRank(currentPeak)) {
      await dbWrite('PATCH', 'users', `id=eq.${u.id}`, { peak_title: currentTitle })
      updated++
    }
  }
  return { checked: users.length, updated }
}

// ── RP-Verfall: täglich nur das Delta abziehen ───────────────
// rpDecay(n) ist kumulativ seit Inaktivitätsbeginn. Um pro Tag nur den
// zusätzlichen Verlust abzuziehen (statt bei jedem Lauf neu zu kumulieren),
// ziehen wir die Differenz zum Vortag ab: rpDecay(n) - rpDecay(n-1).
async function applyRpDecay(today: string) {
  const users: { id: string; rp: number; last_active_date: string | null }[] =
    await dbGet('users', `rp=gt.0&select=id,rp,last_active_date`)

  if (!users || users.length === 0) return { checked: 0, decayed: 0 }

  let decayed = 0
  for (const u of users) {
    if (!u.last_active_date) continue
    const daysInactive = daysBetween(u.last_active_date, today)
    if (daysInactive <= 0) continue

    const decayToday     = rpDecay(daysInactive)
    const decayYesterday = rpDecay(daysInactive - 1)
    const dailyLoss      = decayToday - decayYesterday
    if (dailyLoss <= 0) continue

    const newRp = Math.max(0, u.rp - dailyLoss)
    if (newRp === u.rp) continue

    await dbWrite('PATCH', 'users', `id=eq.${u.id}`, {
      rp: newRp,
      title: titleFromRp(newRp),
    })
    decayed++
  }
  return { checked: users.length, decayed }
}

// ── Saison-Reset (self-healing) ──────────────────────────────
// Prüft, ob eine aktive Season existiert und ob sie abgelaufen ist.
// Fehlt eine aktive Season komplett (Erstlauf oder Datenfehler), wird
// direkt eine neue für den aktuellen Kalendermonat angelegt.
async function checkSeasonReset(today: string) {
  const activeSeasons: { id: string; start_date: string; end_date: string }[] =
    await dbGet('seasons', `is_active=eq.true&select=id,start_date,end_date`)

  const active = activeSeasons?.[0]

  // Fall 1: keine aktive Season vorhanden → self-healing, neue anlegen
  if (!active) {
    const { start, end } = monthBounds(today)
    await dbWrite('POST', 'seasons', '', { start_date: start, end_date: end, is_active: true })
    return { action: 'self_healed_new_season', start, end }
  }

  // Fall 2: aktive Season noch nicht abgelaufen → nichts tun
  if (active.end_date >= today) {
    return { action: 'none', activeSeasonId: active.id, endsAt: active.end_date }
  }

  // Fall 3: aktive Season ist abgelaufen → Reset durchführen
  const users: { id: string; rp: number; title: string | null }[] =
    await dbGet('users', `select=id,rp,title`)

  let snapshotted = 0
  for (const u of users) {
    const rp = u.rp ?? 0
    const peakTitle = u.title ?? 'Nadir'
    // Nur User mit tatsächlicher Aktivität in der Saison snapshotten
    if (rp > 0 || peakTitle !== 'Nadir') {
      await dbWrite('POST', 'user_seasons', '', {
        user_id: u.id,
        season_id: active.id,
        rp,
        peak_title: peakTitle,
      })
      snapshotted++
    }
    await dbWrite('PATCH', 'users', `id=eq.${u.id}`, { rp: 0, title: 'Nadir' })
  }

  // Alte Season schließen, neue für den aktuellen Kalendermonat anlegen
  await dbWrite('PATCH', 'seasons', `id=eq.${active.id}`, { is_active: false })
  const { start, end } = monthBounds(today)
  await dbWrite('POST', 'seasons', '', { start_date: start, end_date: end, is_active: true })

  return { action: 'reset_performed', closedSeasonId: active.id, snapshotted, newStart: start, newEnd: end }
}

// ── Möbius-Sondertitel prüfen ──────────────────────────────────
// Kandidaten: peak_title bereits Praesagium (Lebenszeit-Bestwert, nicht saisonal),
// total_trades >= 500, is_moebius noch false. Für jeden Kandidaten wird das
// Urteilsvermögen aus allen buy_yes/buy_no-Trades auf aufgelösten Märkten
// berechnet (Brier Score, siehe lib/progression.ts). Bei >= 60 wird is_moebius
// dauerhaft auf true gesetzt — kein erneuter Check nötig, da nie wieder verlierbar.
async function checkMoebiusEligibility() {
  const candidates: { id: string; peak_title: string | null; total_trades: number | null }[] =
    await dbGet(
      'users',
      `is_moebius=eq.false&peak_title=eq.${MOEBIUS_MIN_TITLE}&total_trades=gte.${MOEBIUS_MIN_TRADES}&select=id,peak_title,total_trades`
    )

  if (!candidates || candidates.length === 0) return { checked: 0, awarded: 0 }

  let awarded = 0
  for (const c of candidates) {
    const trades: { market_id: string; type: string; price_before: number }[] =
      await dbGet('trades', `user_id=eq.${c.id}&type=in.(buy_yes,buy_no)&select=market_id,type,price_before`)

    if (!trades || trades.length === 0) continue

    const seen: Record<string, boolean> = {}
    const marketIds: string[] = []
    trades.forEach(t => { if (!seen[t.market_id]) { seen[t.market_id] = true; marketIds.push(t.market_id) } })

    const markets: { id: string; resolution: string | null }[] =
      await dbGet('markets', `id=in.(${marketIds.join(',')})&resolved=eq.true&select=id,resolution`)

    const resolutions: Record<string, 'yes' | 'no'> = {}
    markets?.forEach(m => {
      if (m.resolution === 'yes' || m.resolution === 'no') resolutions[m.id] = m.resolution
    })

    const judgment = judgmentFromTrades(trades, resolutions)
    if (judgment === null || judgment < MOEBIUS_MIN_JUDGMENT) continue

    await dbWrite('PATCH', 'users', `id=eq.${c.id}`, { is_moebius: true })
    awarded++
  }
  return { checked: candidates.length, awarded }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const host     = request.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const base     = `${protocol}://${host}`
  const today    = todayBerlin()
  const results: Record<string, unknown> = {}

  // --- FINANCE ---
  try {
    const financeResolve = await fetch(`${base}/api/resolve-finance-market`, {
      method: 'POST',
      cache: 'no-store',
    })
    results.financeResolve = await financeResolve.json()
  } catch (e) {
    results.financeResolveError = String(e)
  }
  try {
    const financeCreate = await fetch(`${base}/api/create-finance-market`, {
      method: 'POST',
      cache: 'no-store',
    })
    results.financeCreate = await financeCreate.json()
  } catch (e) {
    results.financeCreateError = String(e)
  }
  // --- SOCCER ---
  try {
    const soccerCreate = await fetch(`${base}/api/create-soccer-market`, {
      method: 'GET',
      cache: 'no-store',
    })
    results.soccerCreate = await soccerCreate.json()
  } catch (e) {
    results.soccerCreateError = String(e)
  }
  try {
    const soccerResolve = await fetch(`${base}/api/resolve-soccer-market`, {
      method: 'GET',
      cache: 'no-store',
    })
    results.soccerResolve = await soccerResolve.json()
  } catch (e) {
    results.soccerResolveError = String(e)
  }
  // --- FORMULA 1 ---
  try {
    const f1Create = await fetch(`${base}/api/create-f1-markets`, {
      method: 'POST',
      cache: 'no-store',
    })
    results.f1Create = await f1Create.json()
  } catch (e) {
    results.f1CreateError = String(e)
  }
  try {
    const f1Resolve = await fetch(`${base}/api/resolve-f1-markets`, {
      method: 'POST',
      cache: 'no-store',
    })
    results.f1Resolve = await f1Resolve.json()
  } catch (e) {
    results.f1ResolveError = String(e)
  }
  // --- WETTER ---
  try {
    const weatherResolve = await fetch(`${base}/api/resolve-weather-market`, {
      method: 'POST',
      cache: 'no-store',
    })
    results.weatherResolve = await weatherResolve.json()
  } catch (e) {
    results.weatherResolveError = String(e)
  }
  try {
    const weatherCreate = await fetch(`${base}/api/create-weather-market`, {
      method: 'POST',
      cache: 'no-store',
    })
    results.weatherCreate = await weatherCreate.json()
  } catch (e) {
    results.weatherCreateError = String(e)
  }

  // --- PROGRESSION: PEAK-TITLE FORTSCHREIBEN ---
  try {
    results.peakTitleUpdate = await updatePeakTitles()
  } catch (e) {
    results.peakTitleUpdateError = String(e)
  }

  // --- PROGRESSION: RP-VERFALL ---
  try {
    results.rpDecay = await applyRpDecay(today)
  } catch (e) {
    results.rpDecayError = String(e)
  }

  // --- PROGRESSION: SAISON-RESET (SELF-HEALING) ---
  try {
    results.seasonCheck = await checkSeasonReset(today)
  } catch (e) {
    results.seasonCheckError = String(e)
  }

  // --- PROGRESSION: MÖBIUS-SONDERTITEL PRÜFEN ---
  try {
    results.moebiusCheck = await checkMoebiusEligibility()
  } catch (e) {
    results.moebiusCheckError = String(e)
  }

  // --- CRON LOG ---
  try {
    const hadErrors =
      ((results.weatherCreate as { errors?: unknown[] })?.errors?.length ?? 0) > 0 ||
      ((results.financeCreate as { errors?: unknown[] })?.errors?.length ?? 0) > 0 ||
      ((results.weatherResolve as { errors?: unknown[] })?.errors?.length ?? 0) > 0 ||
      Object.keys(results).some(k => k.endsWith('Error'))
    await fetch(`${SUPABASE_URL}/rest/v1/cron_logs`, {
      method: 'POST',
      headers: {
        apikey:         SERVICE_KEY,
        Authorization:  `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer:         'return=minimal',
      },
      body: JSON.stringify({ results, had_errors: hadErrors }),
    })
  } catch (e) {
    console.error('cron_log write failed:', e)
  }

  return NextResponse.json({ ok: true, results })
}

export async function POST(request: Request) {
  return GET(request)
}
