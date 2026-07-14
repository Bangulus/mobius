// lib/progression.ts
// Reine Berechnungslogik für das Progressionssystem (XP/Level, RP/Titel).
// Keine DB-Zugriffe hier — wird von Routes/Cron aufgerufen.

const XP_BASE = 80
const XP_STEP = 12

// XP-Kosten, um von Level n auf Level n+1 zu kommen
export function xpForLevel(n: number): number {
  return XP_BASE + (n - 1) * XP_STEP
}

// Kumulierte XP, um von Level 1 auf Level n+1 zu kommen
// (= Summe der Kosten der Level 1..n)
export function cumulativeXpForLevel(n: number): number {
  return XP_BASE * n + (XP_STEP * n * (n - 1)) / 2
}

// Aktuelles Level aus Gesamt-XP ableiten.
// Level n ist erreicht, sobald totalXp >= cumulativeXpForLevel(n-1).
export function levelFromXp(totalXp: number): number {
  if (totalXp < 0) return 1
  const a = XP_STEP / 2 // 6
  const b = XP_BASE - XP_STEP / 2 // 74
  let k = Math.floor((-b + Math.sqrt(b * b + 4 * a * totalXp)) / (2 * a))
  if (k < 0) k = 0
  // Floating-Point-Korrektur an den Grenzen
  while (cumulativeXpForLevel(k + 1) <= totalXp) k++
  while (k > 0 && cumulativeXpForLevel(k) > totalXp) k--
  return k + 1
}

// ── RP / Titel ───────────────────────────────────────────────

const RP_THRESHOLDS: { title: string; min: number }[] = [
  { title: 'Nadir',      min: 0 },
  { title: 'Initiat',    min: 250 },
  { title: 'Bayes',      min: 600 },
  { title: 'Indigator',  min: 1100 },
  { title: 'Mantiker',   min: 1800 },
  { title: 'Theoros',    min: 2700 },
  { title: 'Heliomant',  min: 3800 },
  { title: 'Praesagium', min: 5200 },
]

export function titleFromRp(rp: number): string {
  let result = RP_THRESHOLDS[0].title
  for (const t of RP_THRESHOLDS) {
    if (rp >= t.min) result = t.title
    else break
  }
  return result
}

// Rang eines Titels innerhalb der RP_THRESHOLDS-Reihenfolge (0 = Nadir, 7 = Praesagium).
// Dient dem Vergleich "ist Titel A höher als Titel B" (z.B. für peak_title-Fortschreibung).
const TITLE_ORDER = RP_THRESHOLDS.map(t => t.title)

export function titleRank(title: string): number {
  const idx = TITLE_ORDER.indexOf(title)
  return idx === -1 ? 0 : idx
}

// ── XP/RP-Beträge pro Aktion ─────────────────────────────────

export const XP_TRADE = 10
export const XP_WIN = 25
export const XP_LOSS = 5
export const XP_LOGIN = 5
export const XP_STREAK_7 = 50
export const XP_NEW_CATEGORY = 30

export const RP_WIN = 25
export const RP_LOSS = -5

// Refund-Fall (z.B. Unentschieden bei Soccer-Heim/Auswärts-Markt): Einsatz wird
// erstattet, kleine Teilnahme-XP, aber kein RP-Effekt (weder Gewinn noch Verlust).
export const XP_REFUND = 5
export const RP_REFUND = 0

// ── RP-Verfall ───────────────────────────────────────────────

export const RP_DECAY_PER_DAY = 15
export const RP_DECAY_GRACE_DAYS = 2 // Verfall beginnt ab Tag 3 Inaktivität

// Berechnet den RP-Verlust durch Inaktivität.
// daysInactive: ganze Tage seit letzter Aktivität.
export function rpDecay(daysInactive: number): number {
  const decayDays = Math.max(0, daysInactive - RP_DECAY_GRACE_DAYS)
  return decayDays * RP_DECAY_PER_DAY
}

// ── Möbius-Sondertitel ─────────────────────────────────────────
// Bedingung: peak_title >= Praesagium (Lebenszeit-Bestleistung, nicht saisonal-
// resettbar) + Urteilsvermögen >= 60/100 + min. 500 Trades. Einmal erreicht
// (is_moebius = true in der DB), nie wieder verlierbar — kein erneuter Check nötig.

export const MOEBIUS_MIN_TITLE = 'Praesagium'
export const MOEBIUS_MIN_JUDGMENT = 60 // Urteilsvermögen, Skala 0-100
export const MOEBIUS_MIN_TRADES = 500

// Urteilsvermögen = (1 - BrierScore) × 100.
// price_before ist laut place-bet IMMER die YES-Wahrscheinlichkeit des Marktes
// zum Zeitpunkt des Trades (calcProb(q_yes, q_no, b) / 100) — unabhängig von der
// Kauf-Richtung. Bei buy_no muss daher (1 - price_before) als die vom Nutzer
// implizit seiner eigenen Richtung zugeschriebene Wahrscheinlichkeit verwendet werden.
// Nur buy_yes/buy_no zählen (sell-Trades haben kein eigenes Ergebnis); nur Trades
// auf bereits aufgelösten Märkten (resolutions-Map enthält nur diese).
export function judgmentFromTrades(
  trades: { market_id: string; type: string; price_before: number }[],
  resolutions: Record<string, 'yes' | 'no'>
): number | null {
  let sumSquaredError = 0
  let count = 0

  for (const t of trades) {
    if (t.type !== 'buy_yes' && t.type !== 'buy_no') continue
    const resolution = resolutions[t.market_id]
    if (!resolution) continue // Markt noch nicht aufgelöst oder unbekannt

    const direction: 'yes' | 'no' = t.type === 'buy_yes' ? 'yes' : 'no'
    const forecastProb = direction === 'yes' ? t.price_before : 1 - t.price_before
    const actual = resolution === direction ? 1 : 0
    const error = forecastProb - actual
    sumSquaredError += error * error
    count++
  }

  if (count === 0) return null
  const brierScore = sumSquaredError / count
  return Math.round((1 - brierScore) * 100)
}
