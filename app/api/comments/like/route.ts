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

// POST /api/comments/like
// Body: { comment_id: string }
export async function POST(req: NextRequest) {
  const userId = getTokenUserId(req)
  if (!userId) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const { comment_id } = await req.json()
  if (!comment_id) return NextResponse.json({ error: 'comment_id fehlt' }, { status: 400 })

  // Kommentar laden — eigene Kommentare nicht likebar
  const cRes  = await fetch(`${SUPABASE_URL}/rest/v1/comments?id=eq.${comment_id}&select=user_id,likes`, { headers: adminHeaders() })
  const cData = await cRes.json()
  const comment = cData[0]
  if (!comment) return NextResponse.json({ error: 'Kommentar nicht gefunden' }, { status: 404 })
  if (comment.user_id === userId) return NextResponse.json({ error: 'Eigene Kommentare können nicht geliked werden' }, { status: 403 })

  // Bereits geliked?
  const lRes  = await fetch(`${SUPABASE_URL}/rest/v1/comment_likes?comment_id=eq.${comment_id}&user_id=eq.${userId}&select=id`, { headers: adminHeaders() })
  const lData = await lRes.json()
  const alreadyLiked = lData.length > 0

  if (alreadyLiked) {
    // Unlike
    await fetch(`${SUPABASE_URL}/rest/v1/comment_likes?comment_id=eq.${comment_id}&user_id=eq.${userId}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    })
    const newLikes = Math.max(0, comment.likes - 1)
    await fetch(`${SUPABASE_URL}/rest/v1/comments?id=eq.${comment_id}`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ likes: newLikes }),
    })
    return NextResponse.json({ liked: false, likes: newLikes })
  } else {
    // Like
    await fetch(`${SUPABASE_URL}/rest/v1/comment_likes`, {
      method: 'POST',
      headers: { ...adminHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ comment_id, user_id: userId }),
    })
    const newLikes = comment.likes + 1
    await fetch(`${SUPABASE_URL}/rest/v1/comments?id=eq.${comment_id}`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ likes: newLikes }),
    })
    return NextResponse.json({ liked: true, likes: newLikes })
  }
}
