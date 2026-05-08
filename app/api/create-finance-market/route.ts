import { NextResponse } from 'next/server'
import { FINANCE_ASSETS, finnhubQuote, isMarketOpen, getDayMarketCloseISO, getWeekMarketCloseISO, getBerlinTime } from '@/lib/finnhub'
import { supabaseUrl, supabaseKey } from '@/lib/supabase'

const B = 50

async function getActiveFinanceMarkets() {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/markets?is_auto=eq.true&category=eq.finance&status=eq.open&select=coin,group_title`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
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
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  })
  return res.ok
}

export async function POST() {
  try {
    const activeMarkets = await getActiveFinanceMarkets()

    // Key: "symbol|marketType" → verhindert Duplikate
    const activeKeys = new Set<string>(
      activeMarkets.map((m: { coin: string; group_title: string }) => `${m.coin}|${m.group_title}`)
    )

    const berlin = getBerlinTime()
    const isWeekday = [1, 2, 3, 4, 5].includes(berlin.getDay())
    const created: string[] = []
    const errors: string[] = []

    for (const asset of FINANCE_ASSETS) {
      const marketOpen = isMarketOpen(asset)

      // --- 3-Minuten-Markt ---
      if (marketOpen && !activeKeys.has(`${asset.symbol}|3-Minuten-Markt`)) {
        const price = await finnhubQuote(asset.symbol)
        if (price) {
          const closesAt = new Date(Date.now() + 3 * 60 * 1000).toISOString()
          const ok = await createMarket({
            question: `${asset.label} Up or Down?`,
            description: `Steht ${asset.label} in 3 Minuten höher oder tiefer als jetzt (${price.toFixed(2)})?`,
            status: 'open',
            b: B,
            q_yes: 0,
            q_no: 0,
            closes_at: closesAt,
            category: 'finance',
            group_title: '3-Minuten-Markt',
            short_label: asset.label,
            resolved: false,
            resolution: null,
            display_group: 'Finanzen',
            start_price: price,
            end_price: null,
            is_auto: true,
            coin: asset.symbol,
          })
          if (ok) created.push(`3min:${asset.label}`)
          else errors.push(`3min:${asset.label}`)
        }
      }

      // --- Tagesmarkt (öffnet um 00:00, einmal pro Tag) ---
      if (isWeekday && !activeKeys.has(`${asset.symbol}|Aktueller Handelstag`)) {
        const price = await finnhubQuote(asset.symbol)
        // Auch wenn Markt gerade geschlossen: Preis vom Vortag als Startpreis ist ok
        // Hauptsache ein Preis existiert
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

      // --- Wochenmarkt (öffnet Montag, schließt Freitag) ---
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
