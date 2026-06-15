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

// ── XP/RP-Beträge pro Aktion ─────────────────────────────────

export const XP_TRADE = 10
export const XP_WIN = 25
export const XP_LOSS = 5
export const XP_LOGIN = 5
export const XP_STREAK_7 = 50
export const XP_NEW_CATEGORY = 30

export const RP_WIN = 25
export const RP_LOSS = -5

// ── RP-Verfall ───────────────────────────────────────────────

export const RP_DECAY_PER_DAY = 15
export const RP_DECAY_GRACE_DAYS = 2 // Verfall beginnt ab Tag 3 Inaktivität

// Berechnet den RP-Verlust durch Inaktivität.
// daysInactive: ganze Tage seit letzter Aktivität.
export function rpDecay(daysInactive: number): number {
  const decayDays = Math.max(0, daysInactive - RP_DECAY_GRACE_DAYS)
  return decayDays * RP_DECAY_PER_DAY
}
