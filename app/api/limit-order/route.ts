import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    cache: 'no-store',
  })
  return res.json()
}

async function dbWrite(method: 'POST' | 'PATCH', table: string, filter: string, body: object) {
  const url = filter ? `${SUPABASE_URL}/rest/v1/${table}?${filter}` : `${SUPABASE_URL}/rest/v1/${table}`
  return fetch(url, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
}

function lmsrCost(qYes: number, qNo: number, b: number, side: 'yes' | 'no', shares: number): number {
  const newQYes = side === 'yes' ? qYes + shares : qYes
  const newQNo  = side === 'no'  ? qNo  + shares : qNo
  const before  = b * Math.log(Math.exp(qYes / b) + Math.exp(qNo / b))
  const after   = b * Math.log(Math.exp(newQYes / b) + Math.exp(newQNo / b))
  return Math.max(0, after - before)
}

function lmsrSharesForSpend(qYes: number, qNo: number, b: number, side: 'yes' | 'no', spend: number): number {
  let lo = 0, hi = spend * 10
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2
    if (lmsrCost(qYes, qNo, b, side, mid) < spend) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}

function calcProb(qYes: number, qNo: number, b: number): number {
  const eYes = Math.exp(qYes / b)
  const eNo  = Math.exp(qNo  / b)
  return Math.round((eYes / (eYes + eNo)) * 100)
}

export async function executeLimitOrder(orderId: string): Promise<boolean> {
  const orders = await dbGet('limit_orders', `id=eq.${orderId}&select=*`)
  const order = orders?.[0]
  if (!order || order.status !== 'open') return false

  const markets = await dbGet('markets', `id=eq.${order.market_id}&select=*`)
  const market = markets?.[0]
  if (!market || market.resolved || market.status !== 'open') {
    await dbWrite('PATCH', 'limit_orders', `id=eq.${orderId}`, { status: 'expired' })
    return false
  }

  // Markt abgelaufen?
  const closesAt = new Date(market.closes_at.endsWith('Z') ? market.closes_at : market.closes_at + 'Z')
  if (closesAt.getTime() < Date.now()) {
    await dbWrite('PATCH', 'limit_orders', `id=eq.${orderId}`, { status: 'expired' })
    return false
  }

  const currentProb = calcProb(market.q_yes, market.q_no, market.b)

  // Preis-Check: Limit-Order füllen wenn aktueller Preis <= limit_price (für yes)
  // Für no: aktueller Preis (100-prob) <= limit_price
  const currentPriceForDirection = order.direction === 'yes' ? currentProb : (100 - currentProb)
  if (currentPriceForDirection > order.limit_price) return false

  // User laden
  const users = await dbGet('users', `id=eq.${order.user_id}&select=balance`)
  const user = users?.[0]
  if (!user || user.balance < order.spend) {
    await dbWrite('PATCH', 'limit_orders', `id=eq.${orderId}`, { status: 'cancelled' })
    return false
  }

  const side   = order.direction as 'yes' | 'no'
  const shares = lmsrSharesForSpend(market.q_yes, market.q_no, market.b, side, order.spend)
  const probBefore = calcProb(market.q_yes, market.q_no, market.b) / 100
  const newQYes = side === 'yes' ? market.q_yes + shares : market.q_yes
  const newQNo  = side === 'no'  ? market.q_no  + shares : market.q_no
  const probAfter = calcProb(newQYes, newQNo, market.b) / 100
  const newBalance = Math.round(user.balance - order.spend)

  await dbWrite('POST', 'trades', '', {
    market_id: order.market_id,
    user_id: order.user_id,
    type: side === 'yes' ? 'buy_yes' : 'buy_no',
    shares,
    cost: order.spend,
    price_before: probBefore,
    price_after: probAfter,
  })

  await dbWrite('PATCH', 'markets', `id=eq.${order.market_id}`, { q_yes: newQYes, q_no: newQNo })
  await dbWrite('PATCH', 'users', `id=eq.${order.user_id}`, { balance: newBalance })

  const existingPos = await dbGet('positions', `user_id=eq.${order.user_id}&market_id=eq.${order.market_id}&select=*`)
  if (existingPos?.[0]) {
    const pos = existingPos[0]
    await dbWrite('PATCH', 'positions', `user_id=eq.${order.user_id}&market_id=eq.${order.market_id}`, {
      shares_yes: side === 'yes' ? (pos.shares_yes ?? 0) + shares : (pos.shares_yes ?? 0),
      shares_no:  side === 'no'  ? (pos.shares_no  ?? 0) + shares : (pos.shares_no  ?? 0),
      updated_at: new Date().toISOString(),
    })
  } else {
    await dbWrite('POST', 'positions', '', {
      user_id: order.user_id,
      market_id: order.market_id,
      shares_yes: side === 'yes' ? shares : 0,
      shares_no:  side === 'no'  ? shares : 0,
      updated_at: new Date().toISOString(),
    })
  }

  await dbWrite('PATCH', 'limit_orders', `id=eq.${orderId}`, {
    status: 'filled',
    filled_at: new Date().toISOString(),
  })

  return true
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

  // Order anlegen (expires_at = wenn Markt schließt)
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

  // Sofort prüfen ob Preis schon passt
  const filled = await executeLimitOrder(order.id)

  return NextResponse.json({ success: true, orderId: order.id, filled })
}

// Alle offenen Orders eines Users für einen Markt laden
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const marketId = searchParams.get('marketId')
  const userId   = searchParams.get('userId')
  if (!marketId || !userId) return NextResponse.json([], { status: 200 })

  const orders = await dbGet('limit_orders', `market_id=eq.${marketId}&user_id=eq.${userId}&status=eq.open&select=*&order=created_at.desc`)
  return NextResponse.json(orders ?? [])
}
