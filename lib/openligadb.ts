export interface OpenLigaMatch {
  matchID: number
  matchDateTime: string
  matchDateTimeUTC?: string
  team1: { teamId: number; teamName: string; teamIconUrl: string }
  team2: { teamId: number; teamName: string; teamIconUrl: string }
  matchIsFinished: boolean
  matchResults: Array<{
    resultTypeID: number
    pointsTeam1: number
    pointsTeam2: number
  }>
}

function getCurrentSeason(): number {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  return month >= 7 ? year : year - 1
}

async function getCurrentMatchday(): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.openligadb.de/getcurrentgroup/bl1`,
      { cache: 'no-store' }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.groupOrderID ?? null
  } catch {
    return null
  }
}

export async function getCurrentMatches(): Promise<OpenLigaMatch[]> {
  const season = getCurrentSeason()
  const matchday = await getCurrentMatchday()

  if (matchday !== null) {
    const res = await fetch(
      `https://api.openligadb.de/getmatchdata/bl1/${season}/${matchday}`,
      { cache: 'no-store' }
    )
    if (res.ok) {
      const matches: OpenLigaMatch[] = await res.json()
      if (matches.length > 0) return matches
    }

    if (matchday > 1) {
      const resPrev = await fetch(
        `https://api.openligadb.de/getmatchdata/bl1/${season}/${matchday - 1}`,
        { cache: 'no-store' }
      )
      if (resPrev.ok) {
        const prevMatches: OpenLigaMatch[] = await resPrev.json()
        const currentRes = await fetch(
          `https://api.openligadb.de/getmatchdata/bl1/${season}/${matchday}`,
          { cache: 'no-store' }
        )
        const currentMatches: OpenLigaMatch[] = currentRes.ok ? await currentRes.json() : []
        return [...prevMatches, ...currentMatches]
      }
    }
  }

  const res = await fetch(
    `https://api.openligadb.de/getmatchdata/bl1/${season}`,
    { cache: 'no-store' }
  )
  if (!res.ok) return []
  return res.json()
}

export async function getMatchById(matchId: number): Promise<OpenLigaMatch | null> {
  try {
    const res = await fetch(
      `https://api.openligadb.de/getmatchdata/${matchId}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return null
    const match: OpenLigaMatch = await res.json()
    return match ?? null
  } catch {
    return null
  }
}

export function getMatchOutcome(match: OpenLigaMatch): 'home' | 'draw' | 'away' | null {
  if (!match.matchIsFinished) return null
  const final = match.matchResults.find(r => r.resultTypeID === 2)
  if (!final) return null
  if (final.pointsTeam1 > final.pointsTeam2) return 'home'
  if (final.pointsTeam1 < final.pointsTeam2) return 'away'
  return 'draw'
}

export function getUpcomingMatches(matches: OpenLigaMatch[]): OpenLigaMatch[] {
  const now = new Date()
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return matches.filter(m => {
    if (m.matchIsFinished) return false
    const matchTime = new Date(m.matchDateTime)
    return matchTime > now && matchTime <= in7days
  })
}

export function getFinishedUnresolvedMatches(
  matches: OpenLigaMatch[],
  existingMatchIds: string[]
): OpenLigaMatch[] {
  return matches.filter(m => {
    const matchId = `bl1-${m.matchID}`
    return m.matchIsFinished && existingMatchIds.includes(matchId)
  })
}
