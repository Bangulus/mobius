import { NextRequest, NextResponse } from 'next/server'
import { executeLimitOrder } from '../../../lib/limit-order-executor'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    cache: 'no-store',
  })
  return res.json()
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
  if (!authRes.ok) return NextResponse.json({ error: 'Ungültige Session.' }, { status: 401 })
  const authUser = await authRes.json()
  const userId = authUser?.id
  if (!userId) return NextResponse.json({ error: 'Ungültige Session.' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 }) }

  const { marketId, direction, spend, limitPrice } = body as {
    marketId: string
    direction: 'yes' | 'no'
    spend: number
    limitPrice: number
  }

  if (!marketId || typeof marketId !== 'string') return NextResponse.json({ error: 'Ungültige market_id.' }, { status: 400 })
  if (direction !== 'yes' && direction !== 'no') return NextResponse.json({ error: 'Ungültige Richtung.' }, { status: 400 })
  if (typeof spend !== 'number' || spend <= 0 || spend > 1000000) return NextResponse.json({ error: 'Ungültiger Betrag.' }, { status: 400 })
  if (typeof limitPrice !== 'number' || limitPrice < 1 || limitPrice > 99) return NextResponse.json({ error: 'Ungültiger Limit-Preis.' }, { status: 400 })

  const markets = await dbGet('markets', `id=eq.${marketId}&select=*`)
  const market = markets?.[0]
  if (!market) return NextResponse.json({ error: 'Markt nicht gefunden.' }, { status: 404 })
  if (market.resolved || market.status !== 'open') return NextResponse.json({ error: 'Markt geschlossen.' }, { status: 400 })

  const users = await dbGet('users', `id=eq.${userId}&select=balance`)
  const user = users?.[0]
  if (!user) return NextResponse.json({ error: 'Benutzer nicht gefunden.' }, { status: 404 })
  if (user.balance < spend) return NextResponse.json({ error: 'Nicht genug Guthaben.' }, { status: 400 })

  const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/limit_orders`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      user_id: userId,
      market_id: marketId,
      direction,
      spend,
      limit_price: limitPrice,
      expires_at: market.closes_at,
    }),
  })

  if (!orderRes.ok) return NextResponse.json({ error: 'Fehler beim Speichern.' }, { status: 500 })
  const [order] = await orderRes.json()

  const filled = await executeLimitOrder(order.id)

  return NextResponse.json({ success: true, orderId: order.id, filled })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const marketId = searchParams.get('marketId')
  const userId   = searchParams.get('userId')
  if (!marketId || !userId) return NextResponse.json([], { status: 200 })

  const orders = await dbGet('limit_orders', `market_id=eq.${marketId}&user_id=eq.${userId}&status=eq.open&select=*&order=created_at.desc`)
  return NextResponse.json(orders ?? [])
}
