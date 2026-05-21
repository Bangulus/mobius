import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

function adminHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  }
}

function getTokenUserId(req: NextRequest): string | null {
  try {
    const auth = req.headers.get('authorization')
    if (!auth) return null
    const token = auth.replace('Bearer ', '')
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.sub ?? null
  } catch { return null }
}

// GET /api/comments?market_id=xxx
export async function GET(req: NextRequest) {
  const marketId = req.nextUrl.searchParams.get('market_id')
  if (!marketId) return NextResponse.json({ error: 'market_id fehlt' }, { status: 400 })

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/comments?market_id=eq.${marketId}&order=created_at.desc&select=*`,
    { headers: adminHeaders(), cache: 'no-store' }
  )
  const comments = await res.json()
  if (!Array.isArray(comments)) return NextResponse.json([], { status: 200 })

  // Usernames laden
  const userIds = Array.from(new Set(comments.map((c: { user_id: string }) => c.user_id)))
  let users: { id: string; username: string; avatar_url?: string }[] = []
  if (userIds.length > 0) {
    const uRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=in.(${userIds.join(',')})&select=id,username,avatar_url`,
      { headers: adminHeaders(), cache: 'no-store' }
    )
    users = await uRes.json()
  }
  const userMap = Object.fromEntries(users.map(u => [u.id, u]))

  const result = comments.map((c: {
    id: string; market_id: string; user_id: string;
    content: string; likes: number; created_at: string
  }) => ({
    ...c,
    username:   userMap[c.user_id]?.username  ?? 'Unbekannt',
    avatar_url: userMap[c.user_id]?.avatar_url ?? null,
  }))

  return NextResponse.json(result)
}

// POST /api/comments
export async function POST(req: NextRequest) {
  const userId = getTokenUserId(req)
  if (!userId) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { market_id, content } = await req.json()
  if (!market_id || !content?.trim()) return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 })
  if (content.trim().length > 500) return NextResponse.json({ error: 'Zu lang (max. 500 Zeichen)' }, { status: 400 })

  const res = await fetch(`${SUPABASE_URL}/rest/v1/comments`, {
    method: 'POST',
    headers: { ...adminHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({ market_id, user_id: userId, content: content.trim() }),
  })
  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })

  // Username für Rückgabe
  const uRes  = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=username,avatar_url`, { headers: adminHeaders() })
  const uData = await uRes.json()

  return NextResponse.json({
    ...data[0],
    username:   uData[0]?.username  ?? 'Unbekannt',
    avatar_url: uData[0]?.avatar_url ?? null,
  })
}
