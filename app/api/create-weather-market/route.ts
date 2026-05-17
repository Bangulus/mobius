// app/api/create-weather-market/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { WEATHER_CITIES, getTodayMax, getTodayDateUTC } from '@/lib/openmeteo'

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

async function dbPost(table: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey:          SERVICE_KEY,
      Authorization:   `Bearer ${SERVICE_KEY}`,
      'Content-Type':  'application/json',
      Prefer:          'return=minimal',
    },
    body: JSON.stringify(body),
  })
  return res.ok
}

async function marketExistsForCity(cityId: string, dateStr: string): Promise<boolean> {
  // match_id wird als eindeutiger Key genutzt: 'weather-hamburg-2026-05-17'
  const matchId = `weather-${cityId}-${dateStr}`
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/markets?match_id=eq.${matchId}&select=id&limit=1`,
    {
      headers: {
        apikey:        SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      cache: 'no-store',
    }
  )
  const data = await res.json()
  return Array.isArray(data) && data.length > 0
}

async function run() {
  const today   = getTodayDateUTC()
  const created: string[] = []
  const skipped: string[] = []
  const errors:  string[] = []

  const closesAt = new Date()
  closesAt.setUTCDate(closesAt.getUTCDate() + 1)
  closesAt.setUTCHours(21, 59, 0, 0)
  const closesAtISO = closesAt.toISOString()

  for (const city of WEATHER_CITIES) {
    try {
      const matchId = `weather-${city.id}-${today}`

      const exists = await marketExistsForCity(city.id, today)
      if (exists) { skipped.push(city.id); continue }

      const todayMax = await getTodayMax(city)
      if (todayMax === null) { errors.push(`${city.id}:no-price`); continue }

      const question    = `Wird es morgen in ${city.label} wärmer als heute? (${todayMax}°C)`
      const description = `Löst mit JA auf, wenn das Tagesmaximum von morgen in ${city.label} höher ist als das heutige Maximum von ${todayMax}°C. Datenquelle: Open-Meteo historische Daten.`

      const ok = await dbPost('markets', {
        question,
        description,
        status:        'open',
        b:             100,
        q_yes:         0,
        q_no:          0,
        closes_at:     closesAtISO,
        category:      'weather',
        group_title:   'Wetter',
        short_label:   city.label,
        display_group: `Wetter – ${city.label}`,
        resolved:      false,
        resolution:    null,
        is_auto:       true,
        coin:          null,
        match_id:      matchId,
        start_price:   todayMax,
        end_price:     null,
      })

      if (ok) created.push(city.id)
      else    errors.push(`${city.id}:db-error`)

    } catch (e) {
      errors.push(`${city.id}:${String(e)}`)
    }
  }

  return { ok: true, created, skipped, errors }
}

// POST — vom Cron aufgerufen
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await run())
}

// GET — für manuellen Browser-Trigger
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await run())
}
