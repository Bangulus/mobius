import { NextRequest, NextResponse } from 'next/server'
import { WEATHER_CITIES, getTodayMax, getTodayDateUTC } from '@/lib/openmeteo'

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
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`db:${res.status}:${text}`)
  }
  return true
}

async function marketExistsForCity(cityId: string): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/markets?category=eq.weather&coin=eq.${cityId}&status=eq.open&resolved=eq.false&select=id&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: 'no-store' }
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
      const exists = await marketExistsForCity(city.id)
      if (exists) { skipped.push(city.id); continue }

      const todayMax = await getTodayMax(city)
      if (todayMax === null) { errors.push(`${city.id}:no-price`); continue }

      const question = `Wird es in ${city.label} heute wärmer als gestern? (${todayMax}°C)`

      const description = `Dieser Markt wird mit „Ja" aufgelöst, wenn das von Open-Meteo erfasste Tagesmaximum (temperature_2m_max) für ${city.label} am heutigen Tag höher ist als das gestrige Maximum von ${todayMax}°C. Andernfalls wird dieser Markt mit „Nein" aufgelöst.

Die maßgebliche Quelle für die Auflösung dieses Marktes ist die Open-Meteo Archive API für die Koordinaten ${city.latitude}, ${city.longitude} (Timezone: ${city.timezone}), aus der Möbius auch die zugrunde liegenden Wetterdaten für die Markterstellung und -auflösung bezieht. Maßgeblich ist ausschließlich der Wert laut Open-Meteo, nicht der Wert anderer Wetterdienste, eigener Messungen oder abweichender Quellen.`

      const ok = await dbPost('markets', {
        question,
        description,
        status:        'open',
        b:             100,
        q_yes:         0,
        q_no:          0,
        closes_at:     closesAtISO,
        category:      'weather',
        group_title:   null,
        short_label:   city.label,
        display_group: null,
        resolved:      false,
        resolution:    null,
        is_auto:       true,
        match_id:      null,
        coin:          city.id,
        start_price:   todayMax,
        end_price:     null,
      })

      if (ok) created.push(`${city.id} (${today}: ${todayMax}°C)`)
      else    errors.push(`${city.id}:db-error`)

    } catch (e) {
      errors.push(`${city.id}:${String(e)}`)
    }
  }

  return { ok: true, created, skipped, errors }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await run())
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await run())
}
