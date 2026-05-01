import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mobius-lemon.vercel.app'
const COINS        = ['BTC', 'ETH', 'SOL', 'XRP']

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    cache: 'no-store',
  })
  return res.json()
}

async function getCoinPrice(coin: string): Promise<number | null> {
  try {
    const res  = await fetch(`https://api.coinbase.com/v2/prices/${coin}-USD/spot`, { cache: 'no-store' })
    const data = await res.json()
    return parseFloat(data.data.amount)
  } catch { return null }
}

async function createMarket(coin: string, results: string[]) {
  const price = await getCoinPrice(coin)
  if (!price) { results.push(`${coin}: Preis nicht abrufbar`); return }

  const now      = new Date()
  const closesAt = new Date(now.getTime() + 3 * 60 * 1000)

  const res = await fetch(`${SUPABASE_URL}/rest/v1/markets`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
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

  if (res.ok) {
    results.push(`Erstellt: ${coin} Markt ($${price})`)
  } else {
    const err = await res.text()
    results.push(`Fehler beim Erstellen von ${coin}: ${err}`)
  }
}

export async function POST() {
  const results: string[] = []
  const now    = new Date()
  const nowISO = now.toISOString()

  const allAutoMarkets = await dbGet(
    'markets',
    `is_auto=eq.true&resolved=eq.false&select=id,coin,start_price,closes_at`
  )
  results.push(`Offene Auto-Märkte: ${allAutoMarkets?.length ?? 0}`)
  results.push(`Aktuelle Zeit (UTC): ${nowISO}`)

  // Abgelaufene auflösen + sofort neuen Markt erstellen
  for (const market of (allAutoMarkets ?? [])) {
    const closesAt  = new Date(market.closes_at)
    const isExpired = closesAt.getTime() < now.getTime()
    if (!isExpired) continue

    results.push(`${market.coin} abgelaufen → auflösen`)

    try {
      const res  = await fetch(`${APP_URL}/api/resolve-crypto-market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market_id: market.id }),
      })
      const data = await res.json()

      if (data.message === 'Bereits aufgelöst') {
        results.push(`→ ${market.coin} bereits aufgelöst`)
      } else {
        results.push(`→ ${market.coin} → ${data.resolution} (${data.payouts} Auszahlungen)`)
        // Sofort neuen Markt erstellen — direkt im Cron, kein externer Call
        await createMarket(market.coin, results)
      }
    } catch (e) {
      results.push(`→ Fehler: ${String(e)}`)
      // Trotzdem neuen Markt versuchen
      await createMarket(market.coin, results)
    }
  }

  // Fallback: Coins ohne offenen Markt auffüllen
  const stillOpen = await dbGet(
    'markets',
    `is_auto=eq.true&resolved=eq.false&select=id,coin`
  )
  for (const coin of COINS) {
    const has = (stillOpen ?? []).some((m: { coin: string }) => m.coin === coin)
    if (!has) {
      results.push(`${coin}: kein offener Markt → Fallback erstellen`)
      await createMarket(coin, results)
    } else {
      results.push(`${coin}: offen ✓`)
    }
  }

  return NextResponse.json({ success: true, timestamp: nowISO, results })
}

export async function GET() {
  return POST()
}
