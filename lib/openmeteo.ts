
export interface WeatherCity {
  id: string           // eindeutiger Schlüssel, z.B. 'hamburg'
  label: string        // Anzeigename, z.B. 'Hamburg'
  latitude: number
  longitude: number
  timezone: string     // IANA Timezone für korrekte Tagesberechnung
}

export const WEATHER_CITIES: WeatherCity[] = [
  { id: 'hamburg',      label: 'Hamburg',      latitude: 53.55,  longitude: 10.00,   timezone: 'Europe/Berlin' },
  { id: 'frankfurt',    label: 'Frankfurt',    latitude: 50.11,  longitude: 8.68,    timezone: 'Europe/Berlin' },
  { id: 'zuerich',      label: 'Zürich',       latitude: 47.38,  longitude: 8.54,    timezone: 'Europe/Zurich' },
  { id: 'new_york',     label: 'New York',     latitude: 40.71,  longitude: -74.01,  timezone: 'America/New_York' },
  { id: 'nome',         label: 'Nome',         latitude: 64.50,  longitude: -165.41, timezone: 'America/Nome' },
  { id: 'ulan_bator',   label: 'Ulan Bator',   latitude: 47.91,  longitude: 106.88,  timezone: 'Asia/Ulaanbaatar' },
  { id: 'johannesburg', label: 'Johannesburg', latitude: -26.20, longitude: 28.04,   timezone: 'Africa/Johannesburg' },
  { id: 'lima',         label: 'Lima',         latitude: -12.05, longitude: -77.04,  timezone: 'America/Lima' },
]

// Heutiges Tagesmaximum abrufen (für Markt-Erstellung)
// Gibt temperature_2m_max für heute zurück
export async function getTodayMax(city: WeatherCity): Promise<number | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude',  String(city.latitude))
    url.searchParams.set('longitude', String(city.longitude))
    url.searchParams.set('daily',     'temperature_2m_max')
    url.searchParams.set('timezone',  city.timezone)
    url.searchParams.set('forecast_days', '1')

    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const max = data?.daily?.temperature_2m_max?.[0]
    if (max === undefined || max === null) return null
    return Math.round(max * 10) / 10  // eine Nachkommastelle
  } catch {
    return null
  }
}

// Gestriges Tagesmaximum abrufen (für Markt-Auflösung)
// Nutzt Open-Meteo historische Daten (archive API)
export async function getYesterdayMax(city: WeatherCity): Promise<number | null> {
  try {
    // Gestern im lokalen Datum der Stadt berechnen
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const dateStr = yesterday.toISOString().slice(0, 10)  // 'YYYY-MM-DD'

    const url = new URL('https://archive-api.open-meteo.com/v1/archive')
    url.searchParams.set('latitude',   String(city.latitude))
    url.searchParams.set('longitude',  String(city.longitude))
    url.searchParams.set('start_date', dateStr)
    url.searchParams.set('end_date',   dateStr)
    url.searchParams.set('daily',      'temperature_2m_max')
    url.searchParams.set('timezone',   city.timezone)

    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    const max = data?.daily?.temperature_2m_max?.[0]
    if (max === undefined || max === null) return null
    return Math.round(max * 10) / 10
  } catch {
    return null
  }
}

// Datum von gestern als YYYY-MM-DD (UTC) — für market_id Lookup
export function getYesterdayDateUTC(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

// Datum von heute als YYYY-MM-DD (UTC) — für market_id bei Erstellung
export function getTodayDateUTC(): string {
  return new Date().toISOString().slice(0, 10)
}
