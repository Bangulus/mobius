import { NextRequest, NextResponse } from 'next/server'
import { WEATHER_CITIES, getYesterdayMax } from '@/lib/openmeteo'
import { XP_WIN, XP_LOSS, RP_WIN, RP_LOSS, levelFromXp, titleFromRp } from '@/lib/progression'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CRON_SECRET  = process.env.CRON_SECRET!

function isAuthorized(req: NextRequest): boolean {
  const authHeader  = req.headers.get('authorization')
  const querySecret = new URL(req.url).searchParams.get('secret')
  const host        = req.headers.get('host') ?? ''
  const isInternal  =
    host.includes('vercel.app') ||
    host.includes('localhost') ||
    host.includes('moebiusmarkets.de')
  return (
    authHeader === `Bearer ${CRON_SECRET}` ||
    querySecret === CRON_SECRET ||
    isInternal
  )
}

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    cache: 'no-store',
  })
  return res.json()
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

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ xp: newXp, level: newLevel, rp: newRp, title: newTitle }),
    })
    if (!patchRes.ok) {
      console.error(`awardResolutionXp: users-Update fehlgeschlagen (${patchRes.status}) für User ${userId}.`)
      return
    }

    const eventRes = await fetch(`${SUPABASE_URL}/rest/v1/xp_events`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
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
  const positions = await dbGet('positions', `market_id=eq.${marketId}&select=*`)
  if (!Array.isArray(positions) || positions.length === 0) return

  for (const pos of positions) {
    if (!pos.user_id) continue

    const winShares  = resolution === 'yes' ? (pos.shares_yes ?? 0) : (pos.shares_no ?? 0)
    const loseShares = resolution === 'yes' ? (pos.shares_no  ?? 0) : (pos.shares_yes ?? 0)

    // Gewinner-Seite: Payout + Win-XP/RP
    if (winShares > 0) {
      const payout = Math.round(winShares)

      const userRes = await dbGet('users', `id=eq.${pos.user_id}&select=balance`)
      const user = userRes?.[0]
      if (user) {
        const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${pos.user_id}`, {
          method: 'PATCH',
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ balance: user.balance + payout }),
        })

        if (patchRes.ok) {
          await fetch(`${SUPABASE_URL}/rest/v1/trades`, {
            method: 'POST',
            headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({
              market_id:    marketId,
              user_id:      pos.user_id,
              type:         'payout',
              shares:       payout,
              amount:       payout,
              cost:         -payout,
              price_before: 0,
              price_after:  0,
            }),
          })
          await awardResolutionXp(pos.user_id, true, marketId)
        }
      }
    }

    // Verlierer-Seite: nur Loss-XP/RP, kein Payout
    if (loseShares > 0) {
      await awardResolutionXp(pos.user_id, false, marketId)
    }
  }
}

async function resolveMarket(marketId: string, resolution: 'yes' | 'no', endPrice: number) {
  await fetch(`${SUPABASE_URL}/rest/v1/markets?id=eq.${marketId}`, {
    method: 'PATCH',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ resolved: true, resolution, status: 'resolved', end_price: endPrice }),
  })
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let resolved = 0
  const errors: string[] = []

  for (const city of WEATHER_CITIES) {
    try {
      const markets = await dbGet(
        'markets',
        `category=eq.weather&coin=eq.${city.id}&resolved=eq.false&status=eq.open&select=*&order=created_at.desc&limit=1`
      )

      if (!Array.isArray(markets) || markets.length === 0) continue

      const market = markets[0]

      const closesAt = new Date(market.closes_at)
      if (closesAt.getTime() > Date.now()) continue

      const startPrice = market.start_price
      if (startPrice === null || startPrice === undefined) {
        errors.push(`${city.id}:no-start-price`)
        continue
      }

      const todayMax = await getYesterdayMax(city)
      if (todayMax === null) {
        errors.push(`${city.id}:no-end-price`)
        continue
      }

      const resolution: 'yes' | 'no' = todayMax > startPrice ? 'yes' : 'no'

      await payoutWinners(market.id, resolution)
      await resolveMarket(market.id, resolution, todayMax)
      resolved++

    } catch (e) {
      errors.push(`${city.id}:${String(e)}`)
    }
  }

  return NextResponse.json({ ok: true, resolved, errors })
}

export async function GET(req: NextRequest) {
  return POST(req)
}
