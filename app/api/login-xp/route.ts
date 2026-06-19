import { NextRequest, NextResponse } from 'next/server'
import { XP_LOGIN, XP_STREAK_7, levelFromXp } from '@/lib/progression'
import { getNewBadges } from '@/lib/badges'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    cache: 'no-store',
  })
  return res.json()
}

async function dbWrite(method: 'POST' | 'PATCH' | 'DELETE', table: string, filter: string, body?: object) {
  const url = filter ? `${SUPABASE_URL}/rest/v1/${table}?${filter}` : `${SUPABASE_URL}/rest/v1/${table}`
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res
}

function todayBerlin(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' })
}

function daysBetween(from: string, to: string): number {
  const fromMs = new Date(from + 'T00:00:00Z').getTime()
  const toMs   = new Date(to   + 'T00:00:00Z').getTime()
  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000))
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }
  const userToken = authHeader.replace('Bearer ', '').trim()

  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${userToken}` },
    cache: 'no-store',
  })
  if (!authRes.ok) {
    return NextResponse.json({ error: 'Ungültige Session.' }, { status: 401 })
  }
  const authUser = await authRes.json()
  const userId = authUser?.id
  if (!userId) {
    return NextResponse.json({ error: 'Ungültige Session.' }, { status: 401 })
  }

  const userRows = await dbGet('users', `id=eq.${userId}&select=xp,login_streak,last_login_date,total_trades`)
  const u = userRows?.[0]
  if (!u) {
    return NextResponse.json({ error: 'Benutzer nicht gefunden.' }, { status: 404 })
  }

  const today = todayBerlin()
  const lastLogin: string | null = u.last_login_date ?? null
  const currentStreak: number = u.login_streak ?? 0
  const currentXp: number = u.xp ?? 0

  if (lastLogin === today) {
    return NextResponse.json({ success: true, alreadyAwarded: true, streak: currentStreak })
  }

  const gap = lastLogin ? daysBetween(lastLogin, today) : null
  const newStreak = gap === 1 ? currentStreak + 1 : 1

  let xpGain = XP_LOGIN
  const streakBonusAwarded = newStreak > 0 && newStreak % 7 === 0
  if (streakBonusAwarded) xpGain += XP_STREAK_7

  const newXp = currentXp + xpGain
  const newLevel = levelFromXp(newXp)

  const patchRes = await dbWrite('PATCH', 'users', `id=eq.${userId}`, {
    xp: newXp,
    level: newLevel,
    login_streak: newStreak,
    last_login_date: today,
    last_active_date: today,
  })
  if (!patchRes.ok) {
    return NextResponse.json({ error: 'Update fehlgeschlagen.' }, { status: 500 })
  }

  await dbWrite('POST', 'xp_events', '', {
    user_id: userId,
    type: 'login',
    xp_delta: XP_LOGIN,
    rp_delta: 0,
    market_id: null,
  })
  if (streakBonusAwarded) {
    await dbWrite('POST', 'xp_events', '', {
      user_id: userId,
      type: 'streak_bonus',
      xp_delta: XP_STREAK_7,
      rp_delta: 0,
      market_id: null,
    })
  }

  // Badge-Vergabe
  const newBadges: string[] = []
  try {
    const existingRows = await dbGet('user_badges', `user_id=eq.${userId}&select=badge_id`)
    const existing = (existingRows ?? []).map((r: { badge_id: string }) => r.badge_id)

    // Wins zählen aus xp_events
    const winRows = await dbGet('xp_events', `user_id=eq.${userId}&type=eq.win&select=id`)
    const totalWins = (winRows ?? []).length

    const earned = getNewBadges(existing, u.total_trades ?? 0, totalWins, newStreak)

    for (const badge of earned) {
      await dbWrite('POST', 'user_badges', '', {
        user_id: userId,
        badge_id: badge.id,
      })
      newBadges.push(badge.id)
    }
  } catch (err) {
    console.error('Badge-Vergabe login-xp fehlgeschlagen:', err)
  }

  return NextResponse.json({
    success: true,
    alreadyAwarded: false,
    streak: newStreak,
    streakBonusAwarded,
    xpGain,
    newXp,
    newLevel,
    newBadges,
  })
}
