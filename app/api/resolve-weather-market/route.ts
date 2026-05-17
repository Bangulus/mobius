// app/api/resolve-weather-market/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { WEATHER_CITIES, getYesterdayMax, getYesterdayDateUTC } from '@/lib/openmeteo'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CRON_SECRET  = process.env.CRON_SECRET!

function isAuthorized(req: NextRequest): boolean {
  const authHeader  = req.headers.get('authorization')
  const querySecret = new URL(req.url).searchParams.get('secret')
  const host        = req.headers.get('host') ?? ''
  const isInternal  = host.includes('vercel.app') || host.includes('localhost')
  return (
    authHeader === `Bearer ${CRON_SECRET}` ||
    querySecret === CRON_SECRET ||
    isInternal
  )
}

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      apikey:        SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    cache: 'no-store',
  })
  return res.json()
}

async function payoutWinners(marketId: string, resolution: 'yes' | 'no') {
  // Alle Positionen für diesen Markt laden
  const positions = await dbGet('positions', `market_id=eq.${marketId}&select=*`)
  if (!Array.isArray(positions) || positions.length === 0) return

  for (const pos of positions) {
    const shares = resolution === 'yes' ? (pos.shares_yes ?? 0) : (pos.shares_no ?? 0)
    if (shares <= 0) continue

    const payout = Math.round(shares)

    // Balance updaten
    const userRes = await dbGet('users', `id=eq.${pos.user_id}&select=balance`)
    const user = userRes?.[0]
    if (!user) continue

    await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${pos.user_id}`, {
      method: 'PATCH',
      headers: {
        apikey:          SERVICE_KEY,
        Authorization:   `Bearer ${SERVICE_KEY}`,
        'Content-Type':  'application/json',
        Prefer:          'return=minimal',
      },
      body: JSON.stringify({ balance: user.balance + payout }),
    })

    // Payout-Trade eintragen
    await fetch(`${SUPABASE_URL}/rest/v1/trades`, {
      method: 'POST',
      headers: {
        apikey:          SERVICE_KEY,
        Authorization:   `Bearer ${SERVICE_KEY}`,
        'Content-Type':  'application/json',
        Prefer:          'return=minimal',
      },
      body: JSON.stringify({
        market_id:   marketId,
        user_id:     pos.user_id,
        type:        'payout',
        shares:      payout,
        amount:      payout,
        cost:        -payout,
        price_before: 0,
        price_after:  0,
      }),
    })
  }
}

async function resolveMarket(marketId: string, resolution: 'yes' | 'no', endPrice: number) {
  await fetch(`${SUPABASE_URL}/rest/v1/markets?id=eq.${marketId}`, {
    method: 'PATCH',
    headers: {
      apikey:          SERVICE_KEY,
      Authorization:   `Bearer ${SERVICE_KEY}`,
      'Content-Type':  'application/json',
      Prefer:          'return=minimal',
    },
    body: JSON.stringify({
      resolved:   true,
      resolution,
      status:     'resolved',
      end_price:  endPrice,
    }),
  })
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const yesterday = getYesterdayDateUTC()
  let resolved = 0
  const errors: string[] = []

  for (const city of WEATHER_CITIES) {
    try {
      const matchId = `weather-${city.id}-${yesterday}`

      // Offenen Markt für gestern suchen
      const markets = await dbGet(
        'markets',
        `match_id=eq.${matchId}&resolved=eq.false&status=eq.open&select=*&limit=1`
      )

      if (!Array.isArray(markets) || markets.length === 0) continue

      const market = markets[0]
      const todayMax = market.start_price  // Gestriges Max (war "heute" bei Erstellung)

      if (todayMax === null || todayMax === undefined) {
        errors.push(`${city.id}:no-start-price`)
        continue
      }

      // Heutiges Tagesmaximum abrufen (= "morgen" aus Sicht des Marktes)
      const tomorrowMax = await getYesterdayMax(city)
      if (tomorrowMax === null) {
        errors.push(`${city.id}:no-end-price`)
        continue
      }

      // Auflösung: wärmer als gestern?
      const resolution: 'yes' | 'no' = tomorrowMax > todayMax ? 'yes' : 'no'

      await payoutWinners(market.id, resolution)
      await resolveMarket(market.id, resolution, tomorrowMax)
      resolved++

    } catch (e) {
      errors.push(`${city.id}:${String(e)}`)
    }
  }

  return NextResponse.json({ ok: true, resolved, errors })
}
