import { NextRequest, NextResponse } from 'next/server'
import { XP_WIN, XP_LOSS, RP_WIN, RP_LOSS, levelFromXp, titleFromRp } from '@/lib/progression'

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const CRON_SECRET   = process.env.CRON_SECRET!

function isAuthorized(req: NextRequest): boolean {
  const authHeader  = req.headers.get('authorization')
  const querySecret = new URL(req.url).searchParams.get('secret')
  const host   = req.headers.get('host') ?? ''
  const origin = req.headers.get('origin') ?? ''
  const isInternal =
    origin.includes('mobius-lemon.vercel.app') ||
    origin.includes('moebiusmarkets.de') ||
    origin.includes('localhost') ||
    host.includes('vercel.app') ||
    host.includes('moebiusmarkets.de')
  return (
    authHeader === `Bearer ${CRON_SECRET}` ||
    querySecret === CRON_SECRET ||
    isInternal
  )
}

async function getCoinPrice(coin: string): Promise<number | null> {
  try {
    const res  = await fetch(`https://api.coinbase.com/v2/prices/${coin}-USD/spot`, { cache: 'no-store' })
    const data = await res.json()
    return parseFloat(data.data.amount)
  } catch { return null }
}

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    cache: 'no-store',
  })
  return res.json()
}

async function dbPatch(table: string, filter: string, body: object) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  return res
}

async function dbPost(table: string, body: object) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  return res
}

// Progression: Gewinn/Verlust-XP + RP nach Marktauflösung verbuchen.
// Fehler hier werden geloggt, blockieren aber nicht den Payout-Flow.
async function awardResolutionXp(userId: string, won: boolean, marketId: string) {
  try {
    const userRows = await dbGet('users', `id=eq.${userId}&select=xp,rp`)
    const u = userRows?.[0]
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

    const patchRes = await dbPatch('users', `id=eq.${userId}`, {
      xp: newXp,
      level: newLevel,
      rp: newRp,
      title: newTitle,
    })
    if (!patchRes.ok) {
      console.error(`awardResolutionXp: users-Update fehlgeschlagen (${patchRes.status}) für User ${userId}.`)
      return
    }

    const eventRes = await dbPost('xp_events', {
      user_id: userId,
      type: won ? 'win' : 'loss',
      xp_delta: xpDelta,
      rp_delta: rpDelta,
      market_id: marketId,
    })
    if (!eventRes.ok) {
      console.error(`awardResolutionXp: xp_events-Insert fehlgeschlagen (${eventRes.status}) für User ${userId}.`)
    }
  } catch (err) {
    console.error('awardResolutionXp: unerwarteter Fehler', err)
  }
}

async function resolveMarket(marketId: string, coin: string, startPrice: number) {
  const endPrice = await getCoinPrice(coin)
  if (!endPrice) return { error: 'Preis nicht abrufbar' }

  const resolution = endPrice > startPrice ? 'yes' : 'no'

  await dbPatch('markets', `id=eq.${marketId}`, {
    resolved: true, resolution, status: 'resolved', end_price: endPrice,
  })

  const positions = await dbGet('positions', `market_id=eq.${marketId}&select=*`)
  let payoutCount = 0
  const errors: string[] = []

  for (const pos of (positions ?? [])) {
    if (!pos.user_id) continue

    const winningShares = resolution === 'yes' ? (pos.shares_yes ?? 0) : (pos.shares_no ?? 0)
    const losingShares  = resolution === 'yes' ? (pos.shares_no  ?? 0) : (pos.shares_yes ?? 0)

    // Gewinner-Seite: Payout + Win-XP/RP
    if (winningShares > 0) {
      const payout = Math.round(winningShares)
      const users = await dbGet('users', `id=eq.${pos.user_id}&select=balance`)
      const currentBalance = users?.[0]?.balance ?? 0
      const patchRes = await dbPatch('users', `id=eq.${pos.user_id}`, {
        balance: Math.round(currentBalance + payout),
      })
      if (patchRes.ok) {
        payoutCount++
        await dbPost('trades', {
          market_id: marketId,
          user_id: pos.user_id,
          type: 'payout',
          shares: payout,
          cost: payout,
          price_before: 0,
          price_after: 0,
        })
        await awardResolutionXp(pos.user_id, true, marketId)
      } else {
        errors.push(`user ${pos.user_id}: ${patchRes.status}`)
      }
    }

    // Verlierer-Seite: nur Loss-XP/RP, kein Payout
    if (losingShares > 0) {
      await awardResolutionXp(pos.user_id, false, marketId)
    }
  }

  await fetch(`${SUPABASE_URL}/rest/v1/positions?market_id=eq.${marketId}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })

  return { success: true, market_id: marketId, resolution, end_price: endPrice, payouts: payoutCount, errors }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Einzelner Markt per market_id
  try {
    const body = await req.json()
    const marketId = body?.market_id
    if (marketId && typeof marketId === 'string' && marketId.length <= 100) {
      const markets = await dbGet('markets', `id=eq.${marketId}&select=*`)
      const market  = markets?.[0]
      if (!market)         return NextResponse.json({ message: 'Markt nicht gefunden' })
      if (market.resolved) return NextResponse.json({ message: 'Bereits aufgelöst' })
      const result = await resolveMarket(marketId, market.coin ?? 'BTC', market.start_price ?? 0)
      return NextResponse.json(result)
    }
  } catch {}

  // Kein Body — alle abgelaufenen Krypto-Märkte auflösen
  const now = new Date().toISOString()
  const expired = await dbGet(
    'markets',
    `is_auto=eq.true&category=eq.Krypto&resolved=eq.false&status=eq.open&closes_at=lt.${now}&select=*`
  )

  if (!Array.isArray(expired) || expired.length === 0) {
    return NextResponse.json({ ok: true, resolved: [], message: 'Keine abgelaufenen Märkte' })
  }

  const results = []
  for (const market of expired) {
    const result = await resolveMarket(market.id, market.coin ?? 'BTC', market.start_price ?? 0)
    results.push(result)
  }

  return NextResponse.json({ ok: true, resolved: results })
}
