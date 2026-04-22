import { NextResponse } from 'next/server'

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

const COINS: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  XRP: 'XRP',
}

async function getCoinPrice(coin: string): Promise<number | null> {
  try {
    const res  = await fetch(`https://api.coinbase.com/v2/prices/${coin}-USD/spot`, { cache: 'no-store' })
    const data = await res.json()
    return parseFloat(data.data.amount)
  } catch { return null }
}

export async function POST(req: Request) {
  const body     = await req.json().catch(() => ({}))
  const coin     = (body.coin ?? 'BTC').toUpperCase()
  const minutes  = body.minutes ?? 3

  if (!COINS[coin]) {
    return NextResponse.json({ error: `Unbekannte Münze: ${coin}` }, { status: 400 })
  }

  const startPrice = await getCoinPrice(coin)
  if (!startPrice) {
    return NextResponse.json({ error: 'Preis konnte nicht abgerufen werden' }, { status: 500 })
  }

  const now      = new Date()
  const closesAt = new Date(now.getTime() + minutes * 60 * 1000)
  const priceStr = startPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const timeStr  = closesAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

  const marketBody = {
    question:    `Ist der ${COINS[coin]}-Preis um ${timeStr} Uhr höher als $${priceStr}?`,
    short_label: `${coin} Up or Down · ${minutes} Min`,
    description: `Startpreis: $${priceStr}. Auflösung per Coinbase ${coin}/USD. Markt läuft ${minutes} Minuten.`,
    category:    'Krypto',
    status:      'open',
    b:           100,
    q_yes:       0,
    q_no:        0,
    closes_at:   closesAt.toISOString(),
    start_price: startPrice,
    is_auto:     true,
    coin:        coin,
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/markets`, {
    method: 'POST',
    headers: {
      apikey:        serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer:        'return=representation',
    },
    body: JSON.stringify(marketBody),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 500 })
  }

  const market = await res.json()
  return NextResponse.json({ success: true, market: market[0], startPrice, coin })
}
