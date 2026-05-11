import { NextResponse } from 'next/server'
import { FINANCE_ASSETS, finnhubQuote, isMarketOpen, getDayMarketCloseISO, getWeekMarketCloseISO, getBerlinTime } from '@/lib/finnhub'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getAdminHeaders() {
  return {
    apikey: supabaseServiceKey,
    Authorization: `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
  }
}

const B = 50

async function getActiveFinanceMarkets() {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/markets?is_auto=eq.true&category=eq.finance&status=eq.open&select=coin,group_title`,
    {
      headers: getAdminHeaders(),
      cache: 'no-store',
    }
  )
  if (!res.ok) return []
  return res.json()
}

async function createMarket(payload: Record<string, unknown>) {
  const res = await fetch(`${supabaseUrl}/rest/v1/markets`, {
    method: 'POST',
    headers: {
      ...getAdminHeaders(),
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  })
  return res.ok
}

export async function POST() {
  try {
    const activeMarkets = await getActiveFinanceMarkets()

    const activeKeys = new Set<string>(
      activeMarkets.map((m: { coin: string; group_title: string }) => `${m.coin}|${m.group_title}`)
    )

    const berlin = getBerlinTime()
    const isWeekday = [1, 2, 3, 4, 5].includes(berlin.getDay())
    const created: string[] = []
    const errors: string[] = []

    for (const asset of FINANCE_ASSETS) {
      const marketOpen = isMarketOpen(asset)


      // --- Tagesmarkt ---
      if (isWeekday && !activeKeys.has(`${asset.symbol}|Aktueller Handelstag`)) {
        const price = await finnhubQuote(asset.symbol)
        if (price) {
          const closesAt = getDayMarketCloseISO(asset)
          const ok = await createMarket({
            question: `${asset.label}: Höher oder tiefer zum Tagesschluss?`,
            description: `Steht ${asset.label} am Ende des heutigen Handelstages höher oder tiefer als zu Tagesbeginn (${price.toFixed(2)})?`,
            status: 'open',
            b: B,
            q_yes: 0,
            q_no: 0,
            closes_at: closesAt,
            category: 'finance',
            group_title: 'Aktueller Handelstag',
            short_label: asset.label,
            resolved: false,
            resolution: null,
            display_group: 'Finanzen',
            start_price: price,
            end_price: null,
            is_auto: true,
            coin: asset.symbol,
          })
          if (ok) created.push(`tag:${asset.label}`)
          else errors.push(`tag:${asset.label}`)
        }
      }

      // --- Wochenmarkt ---
      if (isWeekday && !activeKeys.has(`${asset.symbol}|Aktuelle Handelswoche`)) {
        const price = await finnhubQuote(asset.symbol)
        if (price) {
          const closesAt = getWeekMarketCloseISO(asset)
          const ok = await createMarket({
            question: `${asset.label}: Höher oder tiefer zum Wochenschluss?`,
            description: `Steht ${asset.label} am Freitagabend höher oder tiefer als zu Wochenbeginn (${price.toFixed(2)})?`,
            status: 'open',
            b: B,
            q_yes: 0,
            q_no: 0,
            closes_at: closesAt,
            category: 'finance',
            group_title: 'Aktuelle Handelswoche',
            short_label: asset.label,
            resolved: false,
            resolution: null,
            display_group: 'Finanzen',
            start_price: price,
            end_price: null,
            is_auto: true,
            coin: asset.symbol,
          })
          if (ok) created.push(`woche:${asset.label}`)
          else errors.push(`woche:${asset.label}`)
        }
      }
    }

    return NextResponse.json({ created, errors })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
