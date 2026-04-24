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
  const nowISO = now.toISOString()

  // 1. Alle offenen Auto-Märkte laden (nicht nur abgelaufene)
  const allAutoMarkets = await dbGet(
    'markets',
    `is_auto=eq.true&resolved=eq.false&select=id,coin,start_price,closes_at,q_yes,q_no`
  )

  results.push(`Offene Auto-Märkte: ${allAutoMarkets?.length ?? 0}`)
  results.push(`Aktuelle Zeit (UTC): ${nowISO}`)

  // Jeden Markt prüfen ob abgelaufen
  for (const market of (allAutoMarkets ?? [])) {
    const closesAt = new Date(market.closes_at)
    const isExpired = closesAt.getTime() < now.getTime()
    results.push(`Markt ${market.coin}: closes_at=${market.closes_at}, abgelaufen=${isExpired}`)

    if (isExpired) {
      try {
        const res = await fetch(`${APP_URL}/api/resolve-crypto-market`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ market_id: market.id }),
        })
        const data = await res.json()
        results.push(`→ Aufgelöst: ${market.coin} → ${data.resolution} (${data.payouts} Auszahlungen)`)
      } catch (e) {
        results.push(`→ Fehler beim Auflösen: ${String(e)}`)
      }
    }
  }

  // 2. Neue Märkte erstellen falls keiner offen
  for (const coin of COINS) {
    const openForCoin = (allAutoMarkets ?? []).filter(
      (m: { coin: string; closes_at: string }) =>
        m.coin === coin && new Date(m.closes_at).getTime() > now.getTime()
    )

    if (openForCoin.length === 0) {
      try {
        const res = await fetch(`${APP_URL}/api/create-crypto-market`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coin, minutes: 3 }),
        })
        const data = await res.json()
        results.push(`Erstellt: ${coin} Markt ($${data.startPrice})`)
      } catch (e) {
        results.push(`Fehler beim Erstellen von ${coin}: ${String(e)}`)
      }
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: nowISO,
    results,
  })
}

export async function GET() {
  return POST()
}
