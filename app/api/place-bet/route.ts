import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY!
const VALID_COINS    = ['BTC', 'ETH', 'SOL', 'XRP']
const VALID_TYPES    = ['buy_yes', 'buy_no', 'sell_yes', 'sell_no']

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

function lmsrSellReturn(qYes: number, qNo: number, b: number, side: 'yes' | 'no', shares: number): number {
  const newQYes = side === 'yes' ? Math.max(0, qYes - shares) : qYes
  const newQNo  = side === 'no'  ? Math.max(0, qNo  - shares) : qNo
  const before  = b * Math.log(Math.exp(qYes / b) + Math.exp(qNo / b))
  const after   = b * Math.log(Math.exp(newQYes / b) + Math.exp(newQNo / b))
  return Math.max(0, before - after)
}

function calcProb(qYes: number, qNo: number, b: number): number {
  const eYes = Math.exp(qYes / b)
  const eNo  = Math.exp(qNo  / b)
  return Math.round((eYes / (eYes + eNo)) * 100)
}

// Rate Limiter — in-memory, reset bei Serverrestart
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 Minute
  const maxRequests = 30     // max 30 Wetten pro Minute pro IP

  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= maxRequests) return false
  entry.count += 1
  return true
}

export async function POST(req: NextRequest) {
  // Rate Limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte warte kurz.' }, { status: 429 })
  }

  // Auth: Session aus Authorization Header
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Nicht eingeloggt.' }, { status: 401 })
  }
  const userToken = authHeader.replace('Bearer ', '').trim()

  // Token verifizieren — User aus Supabase Auth holen
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${userToken}`,
    },
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

  // Input parsen
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const { marketId, action, direction, spend } = body as {
    marketId: string
    action: 'buy' | 'sell'
    direction: 'yes' | 'no'
    spend: number
  }

  // Input validieren
  if (!marketId || typeof marketId !== 'string' || marketId.length > 100) {
    return NextResponse.json({ error: 'Ungültige market_id.' }, { status: 400 })
  }
  if (action !== 'buy' && action !== 'sell') {
    return NextResponse.json({ error: 'Ungültige Aktion.' }, { status: 400 })
  }
  if (direction !== 'yes' && direction !== 'no') {
    return NextResponse.json({ error: 'Ungültige Richtung.' }, { status: 400 })
  }
  if (action === 'buy') {
    if (typeof spend !== 'number' || spend <= 0 || spend > 1000000 || !Number.isFinite(spend)) {
      return NextResponse.json({ error: 'Ungültiger Betrag.' }, { status: 400 })
    }
  }

  // Markt laden und prüfen
  const markets = await dbGet('markets', `id=eq.${marketId}&select=*`)
  const market = markets?.[0]
  if (!market) {
    return NextResponse.json({ error: 'Markt nicht gefunden.' }, { status: 404 })
  }
  if (market.resolved || market.status !== 'open') {
    return NextResponse.json({ error: 'Markt ist bereits geschlossen.' }, { status: 400 })
  }
  // Markt-Ablauf serverseitig prüfen
  const closesAt = new Date(market.closes_at.endsWith('Z') ? market.closes_at : market.closes_at + 'Z')
  if (closesAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Markt ist abgelaufen.' }, { status: 400 })
  }

  // User laden
  const users = await dbGet('users', `id=eq.${userId}&select=balance`)
  const user = users?.[0]
  if (!user) {
    return NextResponse.json({ error: 'Benutzer nicht gefunden.' }, { status: 404 })
  }

  // ── KAUFEN ──
  if (action === 'buy') {
    // Negativsaldo-Schutz — serverseitig
    if (user.balance < spend) {
      return NextResponse.json({ error: 'Nicht genug Guthaben.' }, { status: 400 })
    }

    const probBefore = calcProb(market.q_yes, market.q_no, market.b) / 100
    const shares     = lmsrSharesForSpend(market.q_yes, market.q_no, market.b, direction, spend)
    const newQYes    = direction === 'yes' ? market.q_yes + shares : market.q_yes
    const newQNo     = direction === 'no'  ? market.q_no  + shares : market.q_no
    const probAfter  = calcProb(newQYes, newQNo, market.b) / 100
    const newBalance = Math.round(user.balance - spend)

    // Trade schreiben
    const tradeRes = await dbWrite('POST', 'trades', '', {
      market_id: marketId,
      user_id: userId,
      type: direction === 'yes' ? 'buy_yes' : 'buy_no',
      shares,
      cost: spend,
      price_before: probBefore,
      price_after: probAfter,
    })
    if (!tradeRes.ok) {
      return NextResponse.json({ error: 'Fehler beim Speichern des Trades.' }, { status: 500 })
    }

    // Markt updaten
    await dbWrite('PATCH', 'markets', `id=eq.${marketId}`, { q_yes: newQYes, q_no: newQNo })

    // Balance updaten
    await dbWrite('PATCH', 'users', `id=eq.${userId}`, { balance: newBalance })

    // Position upsert
    const existingPos = await dbGet('positions', `user_id=eq.${userId}&market_id=eq.${marketId}&select=*`)
    if (existingPos?.[0]) {
      const pos = existingPos[0]
      await dbWrite('PATCH', 'positions', `user_id=eq.${userId}&market_id=eq.${marketId}`, {
        shares_yes: direction === 'yes' ? (pos.shares_yes ?? 0) + shares : (pos.shares_yes ?? 0),
        shares_no:  direction === 'no'  ? (pos.shares_no  ?? 0) + shares : (pos.shares_no  ?? 0),
        updated_at: new Date().toISOString(),
      })
    } else {
      await dbWrite('POST', 'positions', '', {
        user_id: userId,
        market_id: marketId,
        shares_yes: direction === 'yes' ? shares : 0,
        shares_no:  direction === 'no'  ? shares : 0,
        updated_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({ success: true, newBalance, shares: Math.round(shares) })
  }

  // ── VERKAUFEN ──
  if (action === 'sell') {
    const existingPos = await dbGet('positions', `user_id=eq.${userId}&market_id=eq.${marketId}&select=*`)
    const pos = existingPos?.[0]
    if (!pos) {
      return NextResponse.json({ error: 'Keine Position gefunden.' }, { status: 400 })
    }

    const sharesYes  = pos.shares_yes ?? 0
    const sharesNo   = pos.shares_no  ?? 0
    const sellSide   = sharesYes >= sharesNo ? 'yes' : 'no'
    const sellShares = sellSide === 'yes' ? sharesYes : sharesNo

    if (sellShares <= 0) {
      return NextResponse.json({ error: 'Keine Anteile zum Verkaufen.' }, { status: 400 })
    }

    const probBefore = calcProb(market.q_yes, market.q_no, market.b) / 100
    const returnAmt  = lmsrSellReturn(market.q_yes, market.q_no, market.b, sellSide, sellShares)
    const newQYes    = sellSide === 'yes' ? Math.max(0, market.q_yes - sellShares) : market.q_yes
    const newQNo     = sellSide === 'no'  ? Math.max(0, market.q_no  - sellShares) : market.q_no
    const probAfter  = calcProb(newQYes, newQNo, market.b) / 100
    const newBalance = Math.round(user.balance + returnAmt)

    await dbWrite('POST', 'trades', '', {
      market_id: marketId,
      user_id: userId,
      type: sellSide === 'yes' ? 'sell_yes' : 'sell_no',
      shares: sellShares,
      cost: -returnAmt,
      price_before: probBefore,
      price_after: probAfter,
    })

    await dbWrite('PATCH', 'markets', `id=eq.${marketId}`, { q_yes: newQYes, q_no: newQNo })
    await dbWrite('PATCH', 'users', `id=eq.${userId}`, { balance: newBalance })
    await dbWrite('DELETE', 'positions', `user_id=eq.${userId}&market_id=eq.${marketId}`)

    return NextResponse.json({ success: true, newBalance, returned: Math.round(returnAmt) })
  }

  return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 })
}
