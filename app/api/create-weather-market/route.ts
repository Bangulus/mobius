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

async function marketExistsForCity(cityId: string): Promise<boolean> {
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const since = todayStart.toISOString()
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/markets?category=eq.weather&coin=eq.${cityId}&created_at=gte.${since}&select=id&limit=1`,
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

  // Schließzeit: morgen 21:59 UTC (= 23:59 MESZ)
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

      // Titel: "Wird es in Hamburg heute wärmer als gestern? (17°C)"
      // Die Temperatur in Klammern ist der gestrige Wert (= heutiges Max bei Erstellung)
      const question    = `Wird es in ${city.label} heute wärmer als gestern? (${todayMax}°C)`
      const description = `Löst mit JA auf, wenn das Tagesmaximum von heute in ${city.label} höher ist als das gestrige Maximum von ${todayMax}°C.\n\nDatenquelle: Open-Meteo historische Daten (archive-api.open-meteo.com).`

      const ok = await dbPost('markets', {
        question,
        description,
        status:        'open',
        b:             100,
        q_yes:         0,
        q_no:          0,
        closes_at:     closesAtISO,
        category:      'weather',
        group_title:   null,           // KEIN group_title → kein Multi-Outcome-Ranking
        short_label:   city.label,
        display_group: null,           // KEIN display_group → landet in ungrouped
        resolved:      false,
        resolution:    null,
        is_auto:       true,
        match_id:      null,
        coin:          city.id,        // city.id als Identifier für Auflösung
        start_price:   todayMax,       // gestriges Max — Vergleichswert für Auflösung
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
