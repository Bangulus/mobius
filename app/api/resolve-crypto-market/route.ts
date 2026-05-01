import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function getCoinPrice(coin: string): Promise<number | null> {
  try {
    const res  = await fetch(`https://api.coinbase.com/v2/prices/${coin}-USD/spot`, { cache: 'no-store' })
    const data = await res.json()
    return parseFloat(data.data.amount)
  } catch { return null }
}

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    cache: 'no-store',
  })
  return res.json()
}

async function dbPatch(table: string, filter: string, body: object) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  return res
}

export async function POST(req: Request) {
  const body     = await req.json().catch(() => ({}))
  const marketId = body.market_id
  if (!marketId) return NextResponse.json({ error: 'market_id fehlt' }, { status: 400 })

  const markets = await dbGet('markets', `id=eq.${marketId}&select=*`)
  const market  = markets?.[0]
  if (!market)         return NextResponse.json({ error: 'Markt nicht gefunden' }, { status: 404 })
  if (market.resolved) return NextResponse.json({ message: 'Bereits aufgelöst' })

  const endPrice = await getCoinPrice(market.coin ?? 'BTC')
  if (!endPrice) return NextResponse.json({ error: 'Preis nicht abrufbar' }, { status: 500 })

  const resolution = endPrice > (market.start_price ?? 0) ? 'yes' : 'no'

  await dbPatch('markets', `id=eq.${marketId}`, {
    resolved: true, resolution, status: 'resolved', end_price: endPrice,
  })

  const positions = await dbGet('positions', `market_id=eq.${marketId}&select=*`)
  const errors: string[] = []
  let payoutCount = 0

  for (const pos of (positions ?? [])) {
    if (!pos.user_id) continue
    const winningShares = resolution === 'yes' ? (pos.shares_yes ?? 0) : (pos.shares_no ?? 0)
    if (winningShares <= 0) continue
    const payout = Math.round(winningShares)
    const users = await dbGet('users', `id=eq.${pos.user_id}&select=balance`)
    const currentBalance = users?.[0]?.balance ?? 0
    const patchRes = await dbPatch('users', `id=eq.${pos.user_id}`, {
      balance: Math.round(currentBalance + payout),
    })
    if (patchRes.ok) { payoutCount++ }
    else { errors.push(`user ${pos.user_id}: ${patchRes.status}`) }
  }

  await fetch(`${SUPABASE_URL}/rest/v1/positions?market_id=eq.${marketId}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })

  return NextResponse.json({
    success: true, market_id: marketId, resolution,
    end_price: endPrice, start_price: market.start_price,
    payouts: payoutCount, coin: market.coin, errors,
  })
}
