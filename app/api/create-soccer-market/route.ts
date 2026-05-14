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

function getDescription(outcome: 'home' | 'draw' | 'away'): string {
  if (outcome === 'home') {
    return `Gewinnt die Heimmannschaft das Spiel, löst dieser Markt mit „Ja" auf. In allen anderen Fällen – also bei einem Unentschieden oder einem Sieg der Auswärtsmannschaft – löst der Markt mit „Nein" auf.

Maßgeblich ist ausschließlich das Ergebnis nach 90 Minuten regulärer Spielzeit zuzüglich Nachspielzeit. Verlängerung und Elfmeterschießen zählen nicht.

Wird das Spiel verschoben, bleibt der Markt offen, bis die Partie nachgeholt wurde. Wird das Spiel ersatzlos abgesagt, löst der Markt mit „Nein" auf.

Primäre Auflösungsquelle ist die offizielle Spielstatistik des DFB bzw. der DFL. Sollten keine offiziellen Daten innerhalb von zwei Stunden nach Spielende vorliegen, wird auf Basis übereinstimmender Berichte glaubwürdiger Sportmedien aufgelöst.`
  }

  if (outcome === 'draw') {
    return `Endet das Spiel nach 90 Minuten regulärer Spielzeit zuzüglich Nachspielzeit mit einem Unentschieden, löst dieser Markt mit „Ja" auf. In allen anderen Fällen – also bei einem Sieg eines der beiden Teams – löst der Markt mit „Nein" auf.

Verlängerung und Elfmeterschießen zählen nicht.

Wird das Spiel verschoben, bleibt der Markt offen, bis die Partie nachgeholt wurde. Wird das Spiel ersatzlos abgesagt, löst der Markt mit „Nein" auf.

Primäre Auflösungsquelle ist die offizielle Spielstatistik des DFB bzw. der DFL. Sollten keine offiziellen Daten innerhalb von zwei Stunden nach Spielende vorliegen, wird auf Basis übereinstimmender Berichte glaubwürdiger Sportmedien aufgelöst.`
  }

  // away
  return `Gewinnt die Auswärtsmannschaft das Spiel, löst dieser Markt mit „Ja" auf. In allen anderen Fällen – also bei einem Unentschieden oder einem Sieg der Heimmannschaft – löst der Markt mit „Nein" auf.

Maßgeblich ist ausschließlich das Ergebnis nach 90 Minuten regulärer Spielzeit zuzüglich Nachspielzeit. Verlängerung und Elfmeterschießen zählen nicht.

Wird das Spiel verschoben, bleibt der Markt offen, bis die Partie nachgeholt wurde. Wird das Spiel ersatzlos abgesagt, löst der Markt mit „Nein" auf.

Primäre Auflösungsquelle ist die offizielle Spielstatistik des DFB bzw. der DFL. Sollten keine offiziellen Daten innerhalb von zwei Stunden nach Spielende vorliegen, wird auf Basis übereinstimmender Berichte glaubwürdiger Sportmedien aufgelöst.`
}

async function createThreeMarkets(match: OpenLigaMatch) {
  const matchId = `bl1-${match.matchID}`
  const matchUTC = match.matchDateTimeUTC
    ? new Date(match.matchDateTimeUTC.endsWith('Z') ? match.matchDateTimeUTC : match.matchDateTimeUTC + 'Z')
    : new Date(match.matchDateTime + 'Z')
  const closesAt = new Date(matchUTC.getTime() + 115 * 60 * 1000).toISOString()
  const displayGroup = `${match.team1.teamName} vs ${match.team2.teamName}`

  const timeLabel = matchUTC.toLocaleTimeString('de-DE', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  })

  const dateLabel = matchUTC.toLocaleDateString('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  })

  const matchDate = `${dateLabel}, ${timeLabel}`

  const outcomes: { outcome: 'home' | 'draw' | 'away'; question: string; short_label: string }[] = [
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
      description: getDescription(o.outcome),
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
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
