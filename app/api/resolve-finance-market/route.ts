import { NextResponse } from 'next/server'
import { finnhubQuote } from '@/lib/finnhub'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getAdminHeaders() {
  return {
    apikey: supabaseServiceKey,
    Authorization: `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
  }
}

type Market = {
  id: string
  coin: string
  start_price: number
  closes_at: string
  group_title: string
  short_label: string
}

async function getExpiredFinanceMarkets(): Promise<Market[]> {
  const now = new Date().toISOString()
  const res = await fetch(
    `${supabaseUrl}/rest/v1/markets?is_auto=eq.true&category=eq.finance&status=eq.open&resolved=eq.false&closes_at=lt.${now}&select=id,coin,start_price,closes_at,group_title,short_label`,
    { headers: getAdminHeaders(), cache: 'no-store' }
  )
  if (!res.ok) return []
  return res.json()
}

async function resolveMarket(market: Market, endPrice: number, resolution: 'yes' | 'no') {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/markets?id=eq.${market.id}`,
    {
      method: 'PATCH',
      headers: { ...getAdminHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'closed', resolved: true, resolution, end_price: endPrice }),
    }
  )
  return res.ok
}

async function payoutWinners(marketId: string, resolution: 'yes' | 'no') {
  const posRes = await fetch(
    `${supabaseUrl}/rest/v1/positions?market_id=eq.${marketId}&select=user_id,shares_yes,shares_no`,
    { headers: getAdminHeaders(), cache: 'no-store' }
  )
  if (!posRes.ok) return
  const positions = await posRes.json()

  for (const pos of positions) {
    const winShares = resolution === 'yes' ? pos.shares_yes : pos.shares_no
    if (!winShares || winShares <= 0) continue
    const payout = Math.floor(winShares)

    const balRes = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${pos.user_id}&select=balance`,
      { headers: getAdminHeaders(), cache: 'no-store' }
    )
    if (!balRes.ok) continue
    const [user] = await balRes.json()
    if (!user) continue

    const patchRes = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${pos.user_id}`,
      {
        method: 'PATCH',
        headers: { ...getAdminHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({ balance: user.balance + payout }),
      }
    )

    if (patchRes.ok) {
      // Payout-Trade für Wochenranking
      await fetch(`${supabaseUrl}/rest/v1/trades`, {
        method: 'POST',
        headers: { ...getAdminHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({
          market_id: marketId,
          user_id: pos.user_id,
          type: 'payout',
          shares: payout,
          cost: payout,
          price_before: 0,
          price_after: 0,
        }),
      })
    }
  }
}

export async function POST() {
  try {
    const markets = await getExpiredFinanceMarkets()
    const resolved: string[] = []
    const errors: string[] = []

    for (const market of markets) {
      const endPrice = await finnhubQuote(market.coin)
      if (!endPrice || !market.start_price) {
        errors.push(`no-price:${market.short_label}`)
        continue
      }
      const resolution: 'yes' | 'no' = endPrice >= market.start_price ? 'yes' : 'no'
      const ok = await resolveMarket(market, endPrice, resolution)
      if (ok) {
        await payoutWinners(market.id, resolution)
        resolved.push(`${market.group_title}:${market.short_label}→${resolution}`)
      } else {
        errors.push(`${market.short_label}`)
      }
    }

    return NextResponse.json({ resolved, errors })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
