import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CRON_SECRET  = process.env.CRON_SECRET!

const VALID_COINS = ['BTC', 'ETH', 'SOL', 'XRP']

function isAuthorized(req: NextRequest): boolean {
  const authHeader  = req.headers.get('authorization')
  const querySecret = new URL(req.url).searchParams.get('secret')
  const origin      = req.headers.get('origin') ?? ''
  const host        = req.headers.get('host') ?? ''
  const isInternal  = origin.includes('mobius-lemon.vercel.app') || origin.includes('localhost') || host.includes('vercel.app')
  return (
    authHeader === `Bearer ${CRON_SECRET}` ||
    querySecret === CRON_SECRET ||
    isInternal
  )
}

async function getCoinPrice(coin: string): Promise<number | null> {
  try {
    const res  = await fetch(`https://api.coinbase.com/v2/prices/${coin}-USD/spot`, { cache: 'no-store' })
    const data = await res.json()
    return parseFloat(data.data.amount)
  } catch { return null }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let coin: string | undefined
  try {
    const body = await req.json()
    coin = body?.coin
  } catch {}

  if (!coin || typeof coin !== 'string' || !VALID_COINS.includes(coin.toUpperCase())) {
    return NextResponse.json({ error: 'Ungültiger oder fehlender coin. Erlaubt: BTC, ETH, SOL, XRP' }, { status: 400 })
  }

  coin = coin.toUpperCase()

  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/markets?is_auto=eq.true&resolved=eq.false&coin=eq.${coin}&select=id`,
    {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      cache: 'no-store',
    }
  )
  const existing = await checkRes.json()
  if (Array.isArray(existing) && existing.length > 0) {
    return NextResponse.json({ message: 'Markt bereits offen', id: existing[0].id })
  }

  const price = await getCoinPrice(coin)
  if (!price) {
    return NextResponse.json({ error: 'Preis nicht abrufbar' }, { status: 502 })
  }

  const now      = new Date()
  const closesAt = new Date(now.getTime() + 3 * 60 * 1000)

  const res = await fetch(`${SUPABASE_URL}/rest/v1/markets`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      question:    `Ist ${coin} in 3 Minuten höher als jetzt?`,
      short_label: `${coin} Up or Down`,
      description: `Markt schließt um ${closesAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`,
      status:      'open',
      category:    'Krypto',
      b:           100,
      q_yes:       0,
      q_no:        0,
      closes_at:   closesAt.toISOString(),
      resolved:    false,
      is_auto:     true,
      coin,
      start_price: price,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 500 })
  }

  const created = await res.json()
  return NextResponse.json({ message: 'Erstellt', id: created?.[0]?.id, price })
}

export async function GET() {
  return NextResponse.json({ error: 'GET nicht unterstützt' }, { status: 405 })
}
