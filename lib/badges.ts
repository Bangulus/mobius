// lib/badges.ts
// Badge-Definitionen und Vergabe-Logik für Möbius.
// Keine DB-Zugriffe hier — wird von Routes aufgerufen.

export interface BadgeDef {
  id: string
  label: string
  description: string
  icon: string
  category: 'trades' | 'wins' | 'streak'
}

export const BADGES: BadgeDef[] = [
  // Handels-Badges
  { id: 'trades_50',   label: '50 Trades',     description: '50 Trades platziert',    icon: '🥉', category: 'trades' },
  { id: 'trades_250',  label: '250 Trades',    description: '250 Trades platziert',   icon: '🥈', category: 'trades' },
  { id: 'trades_500',  label: '500 Trades',    description: '500 Trades platziert',   icon: '🥇', category: 'trades' },
  { id: 'trades_2500', label: '2.500 Trades',  description: '2.500 Trades platziert', icon: '💎', category: 'trades' },

  // Treffsicherheits-Badges
  { id: 'wins_10',   label: '10 korrekte Prognosen',   description: '10 Märkte korrekt vorhergesagt',   icon: '🎯', category: 'wins' },
  { id: 'wins_50',   label: '50 korrekte Prognosen',   description: '50 Märkte korrekt vorhergesagt',   icon: '🎯', category: 'wins' },
  { id: 'wins_100',  label: '100 korrekte Prognosen',  description: '100 Märkte korrekt vorhergesagt',  icon: '🎯', category: 'wins' },
  { id: 'wins_500',  label: '500 korrekte Prognosen',  description: '500 Märkte korrekt vorhergesagt',  icon: '🎯', category: 'wins' },
  { id: 'wins_750',  label: '750 korrekte Prognosen',  description: '750 Märkte korrekt vorhergesagt',  icon: '🎯', category: 'wins' },
  { id: 'wins_1000', label: '1.000 korrekte Prognosen', description: '1.000 Märkte korrekt vorhergesagt', icon: '🎯', category: 'wins' },

  // Streak-Badges
  { id: 'streak_7',   label: '7-Tage-Streak',   description: '7 Tage Login-Streak',   icon: '🔥', category: 'streak' },
  { id: 'streak_30',  label: '30-Tage-Streak',  description: '30 Tage Login-Streak',  icon: '🔥', category: 'streak' },
  { id: 'streak_100', label: '100-Tage-Streak', description: '100 Tage Login-Streak', icon: '🔥', category: 'streak' },
]

// Welche Badges sollen bei gegebenem Stand vergeben werden?
// Gibt nur neue Badges zurück die noch nicht vergeben wurden.
export function getNewBadges(
  existing: string[],
  totalTrades: number,
  totalWins: number,
  loginStreak: number,
): BadgeDef[] {
  const newBadges: BadgeDef[] = []

  const check = (badge: BadgeDef, condition: boolean) => {
    if (condition && !existing.includes(badge.id)) {
      newBadges.push(badge)
    }
  }

  // Trades
  check(BADGES.find(b => b.id === 'trades_50')!,   totalTrades >= 50)
  check(BADGES.find(b => b.id === 'trades_250')!,  totalTrades >= 250)
  check(BADGES.find(b => b.id === 'trades_500')!,  totalTrades >= 500)
  check(BADGES.find(b => b.id === 'trades_2500')!, totalTrades >= 2500)

  // Wins
  check(BADGES.find(b => b.id === 'wins_10')!,   totalWins >= 10)
  check(BADGES.find(b => b.id === 'wins_50')!,   totalWins >= 50)
  check(BADGES.find(b => b.id === 'wins_100')!,  totalWins >= 100)
  check(BADGES.find(b => b.id === 'wins_500')!,  totalWins >= 500)
  check(BADGES.find(b => b.id === 'wins_750')!,  totalWins >= 750)
  check(BADGES.find(b => b.id === 'wins_1000')!, totalWins >= 1000)

  // Streak
  check(BADGES.find(b => b.id === 'streak_7')!,   loginStreak >= 7)
  check(BADGES.find(b => b.id === 'streak_30')!,  loginStreak >= 30)
  check(BADGES.find(b => b.id === 'streak_100')!, loginStreak >= 100)

  return newBadges
}
