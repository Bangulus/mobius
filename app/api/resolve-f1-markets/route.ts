import { NextResponse } from 'next/server'
import { XP_WIN, XP_LOSS, RP_WIN, RP_LOSS, levelFromXp, titleFromRp } from '@/lib/progression'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1'

async function getLastRaceResults() {
  const year = new Date().getFullYear()
  const res  = await fetch(`${JOLPICA_BASE}/${year}/last/results.json`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  return data?.MRData?.RaceTable?.Races?.[0] ?? null
}

async function getLastQualifyingResults() {
  const year = new Date().getFullYear()
  const res  = await fetch(`${JOLPICA_BASE}/${year}/last/qualifying.json`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  return data?.MRData?.RaceTable?.Races?.[0] ?? null
}

async function getOpenF1Markets(): Promise<any[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/markets?category=eq.formula1&resolved=eq.false&status=eq.open`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  return res.ok ? await res.json() : []
}

async function resolveMarket(id: string, resolution: 'yes' | 'no') {
  await fetch(`${SUPABASE_URL}/rest/v1/markets?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ resolved: true, resolution, status: 'closed' }),
  })
}

// Progression: Gewinn/Verlust-XP + RP nach Marktauflösung verbuchen.
// Fehler hier werden geloggt, blockieren aber nicht den Payout-Flow.
async function awardResolutionXp(userId: string, won: boolean, marketId: string) {
  try {
    const userRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=xp,rp`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    )
    const users: any[] = await userRes.json()
    const u = users?.[0]
    if (!u) {
      console.error(`awardResolutionXp: User ${userId} nicht gefunden.`)
      return
    }

    const currentXp: number = u.xp ?? 0
    const currentRp: number = u.rp ?? 0

    const xpDelta = won ? XP_WIN : XP_LOSS
    const rpDelta = won ? RP_WIN : RP_LOSS

    const newXp = currentXp + xpDelta
    const newRp = Math.max(0, currentRp + rpDelta)
    const newLevel = levelFromXp(newXp)
    const newTitle = titleFromRp(newRp)

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ xp: newXp, level: newLevel, rp: newRp, title: newTitle }),
    })
    if (!patchRes.ok) {
      console.error(`awardResolutionXp: users-Update fehlgeschlagen (${patchRes.status}) für User ${userId}.`)
      return
    }

    const eventRes = await fetch(`${SUPABASE_URL}/rest/v1/xp_events`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        type: won ? 'win' : 'loss',
        xp_delta: xpDelta,
        rp_delta: rpDelta,
        market_id: marketId,
      }),
    })
    if (!eventRes.ok) {
      console.error(`awardResolutionXp: xp_events-Insert fehlgeschlagen (${eventRes.status}) für User ${userId}.`)
    }
  } catch (err) {
    console.error('awardResolutionXp: unerwarteter Fehler', err)
  }
}

async function payoutWinners(marketId: string, resolution: 'yes' | 'no') {
  const field      = resolution === 'yes' ? 'shares_yes' : 'shares_no'
  const loserField = resolution === 'yes' ? 'shares_no'  : 'shares_yes'

  const posRes = await fetch(
    `${SUPABASE_URL}/rest/v1/positions?market_id=eq.${marketId}&${field}=gt.0`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  if (posRes.ok) {
    const positions: any[] = await posRes.json()
    if (positions.length) {
      const marketRes = await fetch(
        `${SUPABASE_URL}/rest/v1/markets?id=eq.${marketId}`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      )
      const markets: any[] = await marketRes.json()
      if (markets.length) {
        const market = markets[0]
        const totalShares = positions.reduce((sum: number, p: any) => sum + p[field], 0)

        for (const pos of positions) {
          const userShares = pos[field] as number
          const payout     = Math.round((userShares / totalShares) * (market.q_yes + market.q_no) * market.b)
          if (payout <= 0) continue

          const userRes = await fetch(
            `${SUPABASE_URL}/rest/v1/users?id=eq.${pos.user_id}&select=balance`,
            { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
          )
          const users: any[] = await userRes.json()
          if (!users.length) continue

          const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${pos.user_id}`, {
            method: 'PATCH',
            headers: {
              apikey: SERVICE_KEY,
              Authorization: `Bearer ${SERVICE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ balance: users[0].balance + payout }),
          })
          if (patchRes.ok) {
            await awardResolutionXp(pos.user_id, true, marketId)
          }
        }
      }
    }
  }

  // Verlierer-Seite: nur Loss-XP/RP, kein Payout
  const loserPosRes = await fetch(
    `${SUPABASE_URL}/rest/v1/positions?market_id=eq.${marketId}&${loserField}=gt.0`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  if (loserPosRes.ok) {
    const loserPositions: any[] = await loserPosRes.json()
    for (const pos of loserPositions) {
      await awardResolutionXp(pos.user_id, false, marketId)
    }
  }
}

function driverInTop(results: any[], familyName: string, topN: number): boolean {
  return results.some(
    (r: any) => r.Driver?.familyName === familyName && parseInt(r.position) <= topN
  )
}

function driverPosition(results: any[], familyName: string): number {
  const r = results.find((r: any) => r.Driver?.familyName === familyName)
  return r ? parseInt(r.position) : 999
}

function isClassified(results: any[], familyName: string): boolean {
  return results.some(
    (r: any) => r.Driver?.familyName === familyName &&
    r.status !== 'Retired' && r.status !== 'Accident'
  )
}

export async function POST() {
  try {
    const [raceData, qualiData, openMarkets] = await Promise.all([
      getLastRaceResults(),
      getLastQualifyingResults(),
      getOpenF1Markets(),
    ])

    if (!openMarkets.length) return NextResponse.json({ skipped: 'Keine offenen F1-Märkte' })

    const raceResults: any[]  = raceData?.Results ?? []
    const qualiResults: any[] = qualiData?.QualifyingResults ?? []
    const raceName: string    = raceData?.raceName ?? ''
    const qualiRaceName: string = qualiData?.raceName ?? ''

    // Nur auflösen wenn API wirklich Ergebnisse hat
    const raceFinished  = raceResults.length > 0
    const qualiFinished = qualiResults.length > 0

    const resolved: string[] = []

    for (const market of openMarkets) {
      const label: string        = market.short_label ?? ''
      const displayGroup: string = market.display_group ?? ''
      let resolution: 'yes' | 'no' | null = null

      // Saison-Märkte: nie automatisch auflösen
      if (displayGroup === 'F1 WM 2026' || displayGroup === 'F1 Saison 2026') continue

      // Rennen-Märkte: nur auflösen wenn die API Ergebnisse für dieses Rennen hat
      const raceMatchesMarket = displayGroup.includes(raceName) && raceFinished
      const qualiMatchesMarket = displayGroup.includes(qualiRaceName) && qualiFinished

      if (label === 'Ferrari Startreihe 1') {
        if (!qualiMatchesMarket) continue
        const top2      = qualiResults.slice(0, 2)
        const ferrariIn = top2.some(
          (r: any) => r.Driver?.familyName === 'Leclerc' || r.Driver?.familyName === 'Hamilton'
        )
        resolution = ferrariIn ? 'yes' : 'no'
      } else {
        if (!raceMatchesMarket) continue

        if (label === 'McLaren Podium') {
          resolution = (driverInTop(raceResults, 'Norris', 3) || driverInTop(raceResults, 'Piastri', 3)) ? 'yes' : 'no'
        }
        if (label === 'Leclerc Top 5') {
          resolution = driverInTop(raceResults, 'Leclerc', 5) ? 'yes' : 'no'
        }
        if (label === 'Bearman Punkte') {
          resolution = driverInTop(raceResults, 'Bearman', 10) ? 'yes' : 'no'
        }
        if (label === 'Stroll Letzter') {
          const classified = raceResults.filter(
            (r: any) => r.status !== 'Retired' && r.status !== 'Accident'
          )
          if (classified.length > 0) {
            resolution = classified[classified.length - 1].Driver?.familyName === 'Stroll' ? 'yes' : 'no'
          }
        }
        if (label === 'Russell vs Antonelli') {
          const russellOk   = isClassified(raceResults, 'Russell')
          const antonelliOk = isClassified(raceResults, 'Antonelli')
          resolution = (russellOk && antonelliOk)
            ? (driverPosition(raceResults, 'Russell') < driverPosition(raceResults, 'Antonelli') ? 'yes' : 'no')
            : 'no'
        }
      }

      if (resolution) {
        await resolveMarket(market.id, resolution)
        await payoutWinners(market.id, resolution)
        resolved.push(`${label} → ${resolution}`)
      }
    }

    return NextResponse.json({ ok: true, resolved })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
