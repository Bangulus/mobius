import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const COINS = ['BTC', 'ETH', 'SOL', 'XRP']
const WEATHER_CITY_COUNT = 8

async function cleanupZombieMarkets() {
  const now = new Date().toISOString()
  await fetch(
    `${SUPABASE_URL}/rest/v1/markets?is_auto=eq.true&category=eq.crypto&resolved=eq.false&status=eq.open&closes_at=lt.${now}`,
    {
      method: 'PATCH',
      headers: {
        apikey:         SERVICE_KEY,
        Authorization:  `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer:         'return=minimal',
      },
      body: JSON.stringify({ status: 'closed', resolved: true, resolution: 'no' }),
    }
  )
}

function isAuthorized(request: Request): boolean {
  const url         = new URL(request.url)
  const querySecret = url.searchParams.get('secret')
  const authHeader  = request.headers.get('authorization')
  const CRON_SECRET = process.env.CRON_SECRET!
  return authHeader === `Bearer ${CRON_SECRET}` || querySecret === CRON_SECRET
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const host     = request.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const base     = `${protocol}://${host}`
  const results: Record<string, unknown> = {}

  // --- ZOMBIE CLEANUP ---
  try {
    await cleanupZombieMarkets()
    results.zombieCleanup = 'ok'
  } catch (e) {
    results.zombieCleanupError = String(e)
  }

  // --- CRYPTO ---
  for (const coin of COINS) {
    try {
      const res = await fetch(`${base}/api/create-crypto-market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coin }),
        cache: 'no-store',
      })
      results[`cryptoCreate_${coin}`] = await res.json()
    } catch (e) {
      results[`cryptoCreate_${coin}_error`] = String(e)
    }
  }
  try {
    const cryptoResolve = await fetch(`${base}/api/resolve-crypto-market`, {
      method: 'POST',
      cache: 'no-store',
    })
    results.cryptoResolve = await cryptoResolve.json()
  } catch (e) {
    results.cryptoResolveError = String(e)
  }

  // --- WETTER SICHERHEITSNETZ ---
  // cron-daily läuft nur ~alle 12h. Fällt dort ein Lauf aus (z. B. Open-Meteo
  // kurzzeitig nicht erreichbar), fehlen Wetter-Märkte bis zu 12h lang.
  // Hier: minütlicher Check, ob weniger als 8 offene Wetter-Märkte existieren,
  // und Nachtriggern von create-weather-market falls nötig.
  try {
    const now = new Date().toISOString()
    const openWeatherRes = await fetch(
      `${SUPABASE_URL}/rest/v1/markets?category=eq.weather&status=eq.open&resolved=eq.false&closes_at=gt.${now}&select=id`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: 'no-store' }
    )
    const openWeather = await openWeatherRes.json()
    const openCount = Array.isArray(openWeather) ? openWeather.length : 0

    if (openCount < WEATHER_CITY_COUNT) {
      const weatherCreate = await fetch(`${base}/api/create-weather-market`, {
        method: 'POST',
        cache: 'no-store',
      })
      results.weatherSafetyNet = { triggered: true, openCountBefore: openCount, result: await weatherCreate.json() }
    } else {
      results.weatherSafetyNet = { triggered: false, openCount }
    }
  } catch (e) {
    results.weatherSafetyNetError = String(e)
  }

  // --- LIMIT ORDERS ---
  try {
    const { executeLimitOrder } = await import('@/lib/limit-order-executor')
    const openOrders = await fetch(
      `${SUPABASE_URL}/rest/v1/limit_orders?status=eq.open&select=*`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: 'no-store' }
    ).then(r => r.json())

    if (Array.isArray(openOrders) && openOrders.length > 0) {
      let filled = 0
      let expired = 0
      for (const order of openOrders) {
        if (order.expires_at && new Date(order.expires_at).getTime() < Date.now()) {
          await fetch(`${SUPABASE_URL}/rest/v1/limit_orders?id=eq.${order.id}`, {
            method: 'PATCH',
            headers: {
              apikey:         SERVICE_KEY,
              Authorization:  `Bearer ${SERVICE_KEY}`,
              'Content-Type': 'application/json',
              Prefer:         'return=minimal',
            },
            body: JSON.stringify({ status: 'expired' }),
          })
          expired++
          continue
        }
        const wasFilled = await executeLimitOrder(order.id)
        if (wasFilled) filled++
      }
      results.limitOrders = { checked: openOrders.length, filled, expired }
    } else {
      results.limitOrders = { checked: 0 }
    }
  } catch (e) {
    results.limitOrdersError = String(e)
  }

  // --- CRON LOG ---
  try {
    const hadErrors = Object.keys(results).some(k => k.endsWith('Error'))
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
