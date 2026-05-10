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
 
export async function getCurrentMatches(): Promise<OpenLigaMatch[]> {
  const season = getCurrentSeason()
  const url = `https://api.openligadb.de/getmatchdata/bl1/${season}`
  const res = await fetch(url, {
    cache: 'no-store', // Fix: war revalidate:60 → gecachte veraltete Ergebnisse
  })
  if (!res.ok) {
    console.error('OpenLigaDB Fehler:', res.status)
    return []
  }
  const matches: OpenLigaMatch[] = await res.json()
  return matches
}
 
export async function getMatchById(matchId: number): Promise<OpenLigaMatch | null> {
  const season = getCurrentSeason()
  const url = `https://api.openligadb.de/getmatchdata/bl1/${season}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const matches: OpenLigaMatch[] = await res.json()
  return matches.find(m => m.matchID === matchId) ?? null
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
  const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  return matches.filter(m => {
    if (m.matchIsFinished) return false
    const matchTime = new Date(m.matchDateTime)
    return matchTime > now && matchTime <= in3days
  })
}
 
export function getFinishedUnresolvedMatches(
  matches: OpenLigaMatch[],
  existingMatchIds: string[]
): OpenLigaMatch[] {
  return matches.filter(m => {
    const matchId = `bl1-${m.matchID}`
    return (
      m.matchIsFinished &&
      existingMatchIds.includes(matchId)
    )
  })
}
