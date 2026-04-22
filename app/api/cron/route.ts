import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mobius-lemon.vercel.app'

const COINS = ['BTC', 'ETH', 'SOL', 'XRP']

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    cache: 'no-store',
  })
  return res.json()
}

export async function POST() {
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
    } catch {
      results.push(`Fehler beim Auflösen von ${market.id}`)
    }
  }

  // 2. Neue Märkte erstellen falls keine offenen existieren
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
        results.push(`Erstellt: ${coin} Markt ($${data.startPrice})`)
      } catch {
        results.push(`Fehler beim Erstellen von ${coin}`)
      }
    }
  }

  return NextResponse.json({ success: true, timestamp: now.toISOString(), results })
}

export async function GET() {
  return POST()
}
