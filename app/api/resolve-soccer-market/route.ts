import { NextResponse } from 'next/server'
import { getMatchById, getMatchOutcome } from '@/lib/openligadb'

export const runtime = 'edge'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function adminHeaders() {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  }
}

async function getOpenSoccerMarkets() {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/markets?category=eq.sport&resolved=eq.false&is_auto=eq.true&select=*`,
    {
      headers: adminHeaders(),
      cache: 'no-store',
    }
  )
  if (!res.ok) return []
  return res.json()
}

async function getUserBalance(userId: string): Promise<number> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=balance`,
    { headers: adminHeaders(), cache: 'no-store' }
  )
  const data = await res.json()
  return data[0]?.balance ?? 0
}

async function updateUserBalance(userId: string, newBalance: number) {
  await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { ...adminHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ balance: newBalance }),
  })
}

async function resolveMarket(marketId: string, resolution: 'yes' | 'no' | 'draw') {
  await fetch(`${supabaseUrl}/rest/v1/markets?id=eq.${marketId}`, {
    method: 'PATCH',
    headers: { ...adminHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ resolved: true, resolution, status: 'closed' }),
  })
}

async function getTradesForMarket(marketId: string) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/trades?market_id=eq.${marketId}&select=*`,
    { headers: adminHeaders(), cache: 'no-store' }
  )
  if (!res.ok) return []
  return res.json()
}

async function payoutWinners(marketId: string, resolution: 'yes' | 'no' | 'draw') {
  const trades = await getTradesForMarket(marketId)
  if (!trades.length) return

  if (resolution === 'draw') {
    const userRefunds: Record<string, number> = {}
    for (const trade of trades) {
      if (trade.type === 'buy_yes' || trade.type === 'buy_no') {
        userRefunds[trade.user_id] = (userRefunds[trade.user_id] ?? 0) + trade.cost
      }
    }
    for (const [userId, refund] of Object.entries(userRefunds)) {
      const current = await getUserBalance(userId)
      await updateUserBalance(userId, current + refund)
    }
    return
  }

  const winningType = resolution === 'yes' ? 'buy_yes' : 'buy_no'
  const userWinnings: Record<string, number> = {}
  for (const trade of trades) {
    if (trade.type === winningType) {
      userWinnings[trade.user_id] = (userWinnings[trade.user_id] ?? 0) + trade.shares
    }
  }
  for (const [userId, winnings] of Object.entries(userWinnings)) {
    const current = await getUserBalance(userId)
    await updateUserBalance(userId, current + winnings)
  }
}

export async function GET() {
  try {
    const openMarkets = await getOpenSoccerMarkets()
    if (!openMarkets.length) {
      return NextResponse.json({ ok: true, resolved: 0, message: 'Keine offenen Märkte' })
    }

    let resolved = 0
    const errors: string[] = []

    for (const market of openMarkets) {
      if (!market.match_id) continue

      // match_id ist "bl1-12345" → matchID = 12345
      const numericId = parseInt(String(market.match_id).replace('bl1-', ''), 10)
      if (isNaN(numericId)) continue

      // Direkt per ID laden — kein Spieltag-Raten mehr
      const match = await getMatchById(numericId)
      if (!match) {
        errors.push(`match-not-found:${market.match_id}`)
        continue
      }

      const outcome = getMatchOutcome(match)
      if (!outcome) continue // Spiel noch nicht fertig

      let resolution: 'yes' | 'no' | 'draw'
      if (outcome === 'draw') {
        resolution = market.outcome === 'draw' ? 'yes' : 'draw'
      } else if (market.outcome === outcome) {
        resolution = 'yes'
      } else {
        resolution = 'no'
      }

      await payoutWinners(market.id, resolution)
      await resolveMarket(market.id, resolution)
      resolved++
    }

    return NextResponse.json({ ok: true, resolved, errors })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
