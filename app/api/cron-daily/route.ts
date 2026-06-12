import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

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
