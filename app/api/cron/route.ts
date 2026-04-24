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
  const now    = new Date()
  const nowISO = now.toISOString()

  // Alle offenen Auto-Märkte laden
  const allAutoMarkets = await dbGet(
    'markets',
    `is_auto=eq.true&resolved=eq.false&select=id,coin,start_price,closes_at`
  )
  results.push(`Offene Auto-Märkte: ${allAutoMarkets?.length ?? 0}`)
  results.push(`Aktuelle Zeit (UTC): ${nowISO}`)

  // Abgelaufene auflösen
  for (const market of (allAutoMarkets ?? [])) {
    const closesAt  = new Date(market.closes_at)
    const isExpired = closesAt.getTime() < now.getTime()
    if (!isExpired) continue

    results.push(`Markt ${market.coin} abgelaufen: ${market.closes_at}`)
    try {
      const res  = await fetch(`${APP_URL}/api/resolve-crypto-market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market_id: market.id }),
      })
      const data = await res.json()
      if (data.message === 'Bereits aufgelöst') {
        results.push(`→ ${market.coin} bereits aufgelöst, übersprungen`)
      } else {
        results.push(`→ Aufgelöst: ${market.coin} → ${data.resolution} (${data.payouts} Auszahlungen)`)
      }
    } catch (e) {
      results.push(`→ Fehler: ${String(e)}`)
    }
  }

  // Neue Märkte nur erstellen wenn KEIN offener Markt für diesen Coin existiert
  // (resolve-crypto-market erstellt bereits sofort einen neuen — Cron ist nur Fallback)
  const stillOpen = await dbGet(
    'markets',
    `is_auto=eq.true&resolved=eq.false&select=id,coin,closes_at`
  )

  for (const coin of COINS) {
    const openForCoin = (stillOpen ?? []).filter(
      (m: { coin: string }) => m.coin === coin
    )
    if (openForCoin.length === 0) {
      results.push(`Kein offener Markt für ${coin} — erstelle neuen`)
      try {
        const res  = await fetch(`${APP_URL}/api/create-crypto-market`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coin, minutes: 3 }),
        })
        const data = await res.json()
        results.push(`Erstellt: ${coin} Markt ($${data.startPrice})`)
      } catch (e) {
        results.push(`Fehler beim Erstellen von ${coin}: ${String(e)}`)
      }
    } else {
      results.push(`${coin}: ${openForCoin.length} offener Markt — kein neuer nötig`)
    }
  }

  return NextResponse.json({ success: true, timestamp: nowISO, results })
}

export async function GET() {
  return POST()
}
