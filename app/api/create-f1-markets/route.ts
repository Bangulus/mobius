import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1'

const B = 50

function lmsrInitial() {
  return { q_yes: 0, q_no: 0 }
}

async function getNextRace() {
  const year = new Date().getFullYear()
  const res  = await fetch(`${JOLPICA_BASE}/${year}.json`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  const races: any[] = data?.MRData?.RaceTable?.Races ?? []
  const now  = new Date()
  // Nächstes Rennen = erstes Rennen dessen Ende (Start + 2h) noch in der Zukunft liegt
  const next = races.find(r => {
    const start = new Date(r.date + 'T' + (r.time ?? '12:00:00Z'))
    const end   = new Date(start.getTime() + 2 * 60 * 60 * 1000)
    return end > now
  })
  return next ?? null
}

async function marketsAlreadyExist(displayGroup: string): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/markets?display_group=eq.${encodeURIComponent(displayGroup)}&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  const data = await res.json()
  return Array.isArray(data) && data.length > 0
}

async function hasUnresolvedF1RaceMarkets(): Promise<boolean> {
  // Prüft ob es noch offene Rennen-Märkte gibt (nicht Saison-Märkte)
  const now = new Date().toISOString()
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/markets?category=eq.formula1&resolved=eq.false&status=eq.open&closes_at=lt.${now}&display_group=not.in.(F1%20WM%202026,F1%20Saison%202026)&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  const data = await res.json()
  return Array.isArray(data) && data.length > 0
}

async function insertMarkets(markets: object[]) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/markets`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(markets),
  })
  return res.ok
}

export async function POST() {
  try {
    const race = await getNextRace()
    if (!race) return NextResponse.json({ skipped: 'Kein nächstes Rennen gefunden' })

    const raceStart  = new Date(race.date + 'T' + (race.time ?? '12:00:00Z'))
    // Rennende = Start + 2 Stunden
    const raceEnd    = new Date(raceStart.getTime() + 2 * 60 * 60 * 1000)
    const now        = new Date()
    const hoursUntil = (raceStart.getTime() - now.getTime()) / 1000 / 60 / 60

    // Zu weit weg
    if (hoursUntil > 700) {
      return NextResponse.json({ skipped: `Rennen in ${Math.round(hoursUntil)}h — zu früh` })
    }

    // Rennen bereits beendet
    if (raceEnd <= now) {
      return NextResponse.json({ skipped: 'Rennen bereits beendet' })
    }

    const raceName     = race.raceName as string
    const round        = race.round    as string
    const displayGroup = `F1 ${raceName} 2026`

    // Märkte für dieses Rennen bereits vorhanden?
    const exists = await marketsAlreadyExist(displayGroup)
    if (exists) return NextResponse.json({ skipped: `Märkte für ${raceName} bereits vorhanden` })

    // Noch unaufgelöste Märkte vom letzten Rennen? → Warten
    const pendingOld = await hasUnresolvedF1RaceMarkets()
    if (pendingOld) {
      return NextResponse.json({ skipped: 'Alte F1-Märkte noch nicht aufgelöst — warte auf Resolver' })
    }

    // closes_at = Rennende (Start + 2h), Qualifying = Start - 24h
    const closesAt         = raceEnd.toISOString()
    const qualifyingCloses = new Date(raceStart.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const { q_yes, q_no }  = lmsrInitial()

    const markets = [
      {
        question:      `Holt McLaren mindestens einen Podiumsplatz beim ${raceName}?`,
        description:   'Löst mit JA auf, wenn Norris oder Piastri unter den Top 3 landen. Quelle: offizielle F1-Ergebnisse.',
        status:        'open',
        b:             B,
        q_yes,
        q_no,
        closes_at:     closesAt,
        category:      'formula1',
        group_title:   `${raceName} — Podium`,
        short_label:   'McLaren Podium',
        display_group: displayGroup,
        resolved:      false,
        is_auto:       true,
        coin:          null,
      },
      {
        question:      `Landet Leclerc beim ${raceName} in den Top 5?`,
        description:   'Löst mit JA auf, wenn Charles Leclerc auf Position 1–5 ins Ziel kommt. Quelle: offizielle F1-Ergebnisse.',
        status:        'open',
        b:             B,
        q_yes,
        q_no,
        closes_at:     closesAt,
        category:      'formula1',
        group_title:   `${raceName} — Fahrerduelle`,
        short_label:   'Leclerc Top 5',
        display_group: displayGroup,
        resolved:      false,
        is_auto:       true,
        coin:          null,
      },
      {
        question:      `Schafft es Bearman beim ${raceName} in die Punkte (Top 10)?`,
        description:   'Löst mit JA auf, wenn Oliver Bearman auf Position 1–10 ins Ziel kommt. Quelle: offizielle F1-Ergebnisse.',
        status:        'open',
        b:             B,
        q_yes,
        q_no,
        closes_at:     closesAt,
        category:      'formula1',
        group_title:   `${raceName} — Rookies`,
        short_label:   'Bearman Punkte',
        display_group: displayGroup,
        resolved:      false,
        is_auto:       true,
        coin:          null,
      },
      {
        question:      `Wird Stroll beim ${raceName} Letzter der Gewerteten?`,
        description:   'Löst mit JA auf, wenn Lance Stroll die niedrigste klassifizierte Position belegt. DNF-Fahrer zählen nicht als gewertet. Quelle: offizielle F1-Ergebnisse.',
        status:        'open',
        b:             B,
        q_yes,
        q_no,
        closes_at:     closesAt,
        category:      'formula1',
        group_title:   `${raceName} — Fahrerduelle`,
        short_label:   'Stroll Letzter',
        display_group: displayGroup,
        resolved:      false,
        is_auto:       true,
        coin:          null,
      },
      {
        question:      `Schlägt Russell seinen Teamkollegen Antonelli beim ${raceName}?`,
        description:   'Löst mit JA auf, wenn George Russell im Rennen besser platziert ist als Kimi Antonelli. Beide müssen ins Ziel kommen. Bei DNF eines der beiden: NEIN.',
        status:        'open',
        b:             B,
        q_yes,
        q_no,
        closes_at:     closesAt,
        category:      'formula1',
        group_title:   `${raceName} — Teamduelle`,
        short_label:   'Russell vs Antonelli',
        display_group: displayGroup,
        resolved:      false,
        is_auto:       true,
        coin:          null,
      },
      {
        question:      `Startet beim ${raceName} ein Ferrari aus der ersten Startreihe?`,
        description:   'Löst mit JA auf, wenn Leclerc oder Hamilton Startplatz 1 oder 2 im Qualifying belegen. Quelle: offizielle Qualifying-Ergebnisse.',
        status:        'open',
        b:             B,
        q_yes,
        q_no,
        closes_at:     qualifyingCloses,
        category:      'formula1',
        group_title:   `${raceName} — Qualifying`,
        short_label:   'Ferrari Startreihe 1',
        display_group: displayGroup,
        resolved:      false,
        is_auto:       true,
        coin:          null,
      },
      {
        question:      'Gewinnt Kimi Antonelli die Fahrerweltmeisterschaft 2026?',
        description:   'Löst mit JA auf, wenn Antonelli am Saisonende die meisten Punkte hat. Läuft bis Saisonende November 2026.',
        status:        'open',
        b:             B,
        q_yes,
        q_no,
        closes_at:     '2026-11-30T23:59:00Z',
        category:      'formula1',
        group_title:   'WM 2026',
        short_label:   'Antonelli WM',
        display_group: 'F1 WM 2026',
        resolved:      false,
        is_auto:       true,
        coin:          null,
      },
      {
        question:      'Verlässt ein Fahrer sein Team noch während der Saison 2026?',
        description:   'Löst mit JA auf, wenn ein aktiver F1-Fahrer vor Saisonende offiziell seinen aktuellen Rennstall verlässt oder ersetzt wird. Rücktritt zählt nicht.',
        status:        'open',
        b:             B,
        q_yes,
        q_no,
        closes_at:     '2026-11-30T23:59:00Z',
        category:      'formula1',
        group_title:   'F1 Saison 2026',
        short_label:   'Teamwechsel Saison',
        display_group: 'F1 Saison 2026',
        resolved:      false,
        is_auto:       true,
        coin:          null,
      },
    ]

    const seasonGroupExists = await marketsAlreadyExist('F1 WM 2026')
    const marketsToInsert   = seasonGroupExists
      ? markets.filter(m => (m as any).display_group === displayGroup)
      : markets

    const ok = await insertMarkets(marketsToInsert)
    if (!ok) return NextResponse.json({ error: 'Insert fehlgeschlagen' }, { status: 500 })

    return NextResponse.json({
      ok:             true,
      race:           raceName,
      round,
      created:        marketsToInsert.length,
      hoursUntilRace: Math.round(hoursUntil),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
