import { NextResponse } from 'next/server'
import { getCurrentMatches, getUpcomingMatches, OpenLigaMatch } from '@/lib/openligadb'

export const runtime = 'edge'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function marketExists(matchId: string): Promise<boolean> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/markets?match_id=eq.${matchId}&select=id&limit=1`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  )
  const data = await res.json()
  return Array.isArray(data) && data.length > 0
}

async function createThreeMarkets(match: OpenLigaMatch) {
  const matchId = `bl1-${match.matchID}`

  // matchDateTimeUTC ist zuverlässig UTC — kein Timezone-Problem
  const matchUTC = match.matchDateTimeUTC
    ? new Date(match.matchDateTimeUTC.endsWith('Z') ? match.matchDateTimeUTC : match.matchDateTimeUTC + 'Z')
    : new Date(match.matchDateTime + 'Z')

  const closesAt = new Date(matchUTC.getTime() + 115 * 60 * 1000).toISOString()
  const displayGroup = `${match.team1.teamName} vs ${match.team2.teamName}`

  // Uhrzeit korrekt in Berliner Zeit — nur HH:MM, klar und einfach
  const timeLabel = matchUTC.toLocaleTimeString('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  })

  // match_date nur als Uhrzeit speichern — das ist alles was wir anzeigen
  const matchDate = timeLabel

  const outcomes = [
    {
      outcome: 'home',
      question: `Gewinnt ${match.team1.teamName} gegen ${match.team2.teamName}?`,
      short_label: match.team1.teamName,
    },
    {
      outcome: 'draw',
      question: `Endet ${match.team1.teamName} vs ${match.team2.teamName} unentschieden?`,
      short_label: 'Unentschieden',
    },
    {
      outcome: 'away',
      question: `Gewinnt ${match.team2.teamName} gegen ${match.team1.teamName}?`,
      short_label: match.team2.teamName,
    },
  ]

  for (const o of outcomes) {
    const body = {
      question: o.question,
      description: `Bundesliga · ${displayGroup} · Anpfiff: ${timeLabel} Uhr`,
      status: 'open',
      b: 100,
      q_yes: 0,
      q_no: 0,
      closes_at: closesAt,
      group_title: 'Bundesliga',
      short_label: o.short_label,
      category: 'sport',
      resolved: false,
      resolution: null,
      display_group: displayGroup,
      is_auto: true,
      match_id: matchId,
      outcome: o.outcome,
      home_team_icon: match.team1.teamIconUrl ?? null,
      away_team_icon: match.team2.teamIconUrl ?? null,
      match_date: matchDate,
    }

    await fetch(`${supabaseUrl}/rest/v1/markets`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    })
  }
}

export async function GET() {
  try {
    const allMatches = await getCurrentMatches()
    const upcoming = getUpcomingMatches(allMatches)
    let created = 0

    for (const match of upcoming) {
      const matchId = `bl1-${match.matchID}`
      const exists = await marketExists(matchId)
      if (exists) continue
      await createThreeMarkets(match)
      created++
    }

    return NextResponse.json({ ok: true, created })
  } catch (err) {
    console.error('create-soccer-market Fehler:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
