import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mobius-lemon.vercel.app'
const CRON_SECRET  = process.env.CRON_SECRET ?? 'mobius-cron-2026'

const COINS = ['BTC', 'ETH', 'SOL', 'XRP']

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    cache: 'no-store',
  })
  return res.json()
}

export async function POST(req: Request) {
  // Sicherheits-Check
  const secret = req.headers.get('x-cron-secret')
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: string[] = []
  const now = new Date()

  // 1. Abgelaufene Märkte auflösen
  const expiredMarkets = await dbGet(
    'markets',
    `is_auto=eq.true&resolved=eq.false&closes_at=lt.${now.toISOString()}&select=id,coin,start_price`
  )

  for (const market of (expiredMarkets ?? [])) {
    try {
      const res = await fetch(`${APP_URL}/api/resolve-crypto-market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market_id: market.id }),
      })
      const data = await res.json()
      results.push(`Aufgelöst: ${market.coin} → ${data.resolution} (${data.payouts} Auszahlungen)`)
    } catch (e) {
      results.push(`Fehler beim Auflösen von ${market.id}`)
    }
  }

  // 2. Neue Märkte erstellen falls keine offenen Krypto-Märkte existieren
  for (const coin of COINS) {
    const openMarkets = await dbGet(
      'markets',
      `is_auto=eq.true&resolved=eq.false&coin=eq.${coin}&select=id`
    )

    if (!openMarkets || openMarkets.length === 0) {
      try {
        const res = await fetch(`${APP_URL}/api/create-crypto-market`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coin, minutes: 3 }),
        })
        const data = await res.json()
        results.push(`Erstellt: ${coin} Markt (${data.startPrice})`)
      } catch (e) {
        results.push(`Fehler beim Erstellen von ${coin}`)
      }
    }
  }

  return NextResponse.json({ success: true, timestamp: now.toISOString(), results })
}

// GET für manuelle Tests
export async function GET(req: Request) {
  return POST(req)
}
