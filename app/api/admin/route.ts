import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ADMIN_ID     = 'b75edaf4-141d-41f1-9555-887a8ddbac58'

function adminHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  }
}

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: adminHeaders(),
    cache: 'no-store',
  })
  return res.json()
}

async function dbWrite(method: 'POST' | 'PATCH' | 'DELETE', table: string, filter: string, body?: object) {
  const url = filter ? `${SUPABASE_URL}/rest/v1/${table}?${filter}` : `${SUPABASE_URL}/rest/v1/${table}`
  return fetch(url, {
    method,
    headers: { ...adminHeaders(), Prefer: method === 'POST' ? 'return=representation' : 'return=minimal' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// Verifiziert, dass der Bearer-Token zu einer eingeloggten Session gehört UND dass
// diese Session dem Admin-Account entspricht. Nur Anthropic — äh, nur ADMIN_ID darf durch.
async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return false
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return false

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return false
  const user = await res.json()
  return user?.id === ADMIN_ID
}

export async function POST(req: NextRequest) {
  const isAdmin = await verifyAdmin(req)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const { action } = body as { action: string }

  switch (action) {
    case 'get_cron_logs': {
      const logs = await dbGet('cron_logs', 'select=*&order=ran_at.desc&limit=20')
      return NextResponse.json({ success: true, logs })
    }

    case 'resolve_market': {
      const { marketId, resolution } = body as { marketId: string; resolution: 'yes' | 'no' }
      if (!marketId || (resolution !== 'yes' && resolution !== 'no')) {
        return NextResponse.json({ error: 'Ungültige Parameter.' }, { status: 400 })
      }
      const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/resolve_market`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ market_id: marketId, resolution }),
      })
      if (!rpcRes.ok) {
        return NextResponse.json({ error: await rpcRes.text() }, { status: 500 })
      }
      await dbWrite('PATCH', 'markets', `id=eq.${marketId}`, { resolved_at: new Date().toISOString() })
      return NextResponse.json({ success: true })
    }

    case 'edit_market': {
      const { marketId, fields } = body as { marketId: string; fields: Record<string, unknown> }
      if (!marketId || !fields) {
        return NextResponse.json({ error: 'Ungültige Parameter.' }, { status: 400 })
      }
      const res = await dbWrite('PATCH', 'markets', `id=eq.${marketId}`, fields)
      if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    case 'delete_market': {
      const { marketId } = body as { marketId: string }
      if (!marketId) return NextResponse.json({ error: 'Ungültige market_id.' }, { status: 400 })
      await dbWrite('DELETE', 'trades', `market_id=eq.${marketId}`)
      await dbWrite('DELETE', 'positions', `market_id=eq.${marketId}`)
      const res = await dbWrite('DELETE', 'markets', `id=eq.${marketId}`)
      if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    case 'create_market': {
      const { fields } = body as { fields: Record<string, unknown> }
      if (!fields) return NextResponse.json({ error: 'Ungültige Felder.' }, { status: 400 })
      const res = await dbWrite('POST', 'markets', '', fields)
      if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    case 'set_user_balance': {
      const { uid, balance } = body as { uid: string; balance: number }
      if (!uid || typeof balance !== 'number' || balance < 0) {
        return NextResponse.json({ error: 'Ungültige Parameter.' }, { status: 400 })
      }
      const res = await dbWrite('PATCH', 'users', `id=eq.${uid}`, { balance })
      if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })
      return NextResponse.json({ success: true, balance })
    }

    case 'add_dukaten': {
      const { uid, amount } = body as { uid: string; amount: number }
      if (!uid || typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json({ error: 'Ungültige Parameter.' }, { status: 400 })
      }
      const userRows = await dbGet('users', `id=eq.${uid}&select=balance`)
      const current = userRows?.[0]?.balance ?? 0
      const newBalance = current + amount
      const res = await dbWrite('PATCH', 'users', `id=eq.${uid}`, { balance: newBalance })
      if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })
      return NextResponse.json({ success: true, balance: newBalance })
    }

    case 'delete_user': {
      const { uid } = body as { uid: string }
      if (!uid) return NextResponse.json({ error: 'Ungültige uid.' }, { status: 400 })
      if (uid === ADMIN_ID) {
        return NextResponse.json({ error: 'Admin-Account kann nicht gelöscht werden.' }, { status: 400 })
      }
      await dbWrite('DELETE', 'trades', `user_id=eq.${uid}`)
      await dbWrite('DELETE', 'positions', `user_id=eq.${uid}`)
      const res = await dbWrite('DELETE', 'users', `id=eq.${uid}`)
      if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    case 'save_progression': {
      const { uid, xp, level, rp, title, badgeIds } = body as {
        uid: string; xp: number; level: number; rp: number; title: string; badgeIds: string[]
      }
      if (!uid) return NextResponse.json({ error: 'Ungültige uid.' }, { status: 400 })

      const patchRes = await dbWrite('PATCH', 'users', `id=eq.${uid}`, { xp, level, rp, title })
      if (!patchRes.ok) return NextResponse.json({ error: await patchRes.text() }, { status: 500 })

      const existingRows = await dbGet('user_badges', `user_id=eq.${uid}&select=badge_id`)
      const existing: string[] = (existingRows ?? []).map((r: { badge_id: string }) => r.badge_id)
      const wanted = new Set(badgeIds ?? [])

      for (const badgeId of Array.from(wanted)) {
        if (!existing.includes(badgeId)) {
          await dbWrite('POST', 'user_badges', '', { user_id: uid, badge_id: badgeId })
        }
      }
      for (const badgeId of existing) {
        if (!wanted.has(badgeId)) {
          await dbWrite('DELETE', 'user_badges', `user_id=eq.${uid}&badge_id=eq.${badgeId}`)
        }
      }
      return NextResponse.json({ success: true })
    }

    default:
      return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
  }
}
