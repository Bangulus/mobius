import { NextResponse } from 'next/server'
import { getCurrentMatches, getMatchOutcome, OpenLigaMatch } from '@/lib/openligadb'

export const runtime = 'edge'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function getOpenSoccerMarkets() {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/markets?category=eq.sport&resolved=eq.false&is_auto=eq.true&select=*`,
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

async function getTradesForMarket(marketId: string) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/trades?market_id=eq.${marketId}&select=*`,
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

async function getUserBalance(userId: string): Promise<number> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=balance`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      cache: 'no-store',
    }
  )
  const data = await res.json()
  return data[0]?.balance ?? 0
}

async function updateUserBalance(userId: string, newBalance: number) {
  await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ balance: newBalance }),
  })
}

async function resolveMarket(marketId: string, resolution: 'yes' | 'no' | 'draw') {
  await fetch(`${supabaseUrl}/rest/v1/markets?id=eq.${marketId}`, {
    method: 'PATCH',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      resolved: true,
      resolution,
      status: 'closed',
    }),
  })
}

async function payoutWinners(marketId: string, resolution: 'yes' | 'no' | 'draw') {
  const trades = await getTradesForMarket(marketId)
  if (!trades.length) return

  // Gewinnertyp bestimmen
  const winningType = resolution === 'yes' ? 'buy_yes' : resolution === 'no' ? 'buy_no' : null

  // Bei Unentschieden: alle bekommen ihren Einsatz zurück
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

  if (!winningType) return

  // Gewinner: 1 Dukat pro Share
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
      return NextResponse.json({ ok: true, resolved: 0 })
    }

    // Alle einzigartigen match_ids sammeln
    const matchIds: string[] = [...new Set(
      openMarkets
        .map((m: any) => m.match_id)
        .filter(Boolean)
    )]

    // OpenLigaDB einmal abfragen
    const allMatches = await getCurrentMatches()
    const matchMap = new Map<string, OpenLigaMatch>()
    for (const match of allMatches) {
      matchMap.set(`bl1-${match.matchID}`, match)
    }

    let resolved = 0

    for (const matchId of matchIds) {
      const match = matchMap.get(matchId)
      if (!match) continue

      const outcome = getMatchOutcome(match)
      if (!outcome) continue // Spiel noch nicht fertig

      // Alle 3 Märkte dieses Spiels holen
      const marketsForMatch = openMarkets.filter((m: any) => m.match_id === matchId)

      for (const market of marketsForMatch) {
        // Bestimmen ob dieser Markt mit YES, NO oder draw aufgelöst wird
        let resolution: 'yes' | 'no' | 'draw'

        if (market.outcome === outcome) {
          // Dieser Outcome ist eingetreten → YES gewinnt
          resolution = 'yes'
        } else if (outcome === 'draw' && market.outcome !== 'draw') {
          // Unentschieden aber dieser Markt ist kein Draw-Markt
          // → Einsatz zurück via draw-resolution
          resolution = 'draw'
        } else {
          resolution = 'no'
        }

        await payoutWinners(market.id, resolution)
        await resolveMarket(market.id, resolution)
        resolved++
      }
    }

    return NextResponse.json({ ok: true, resolved })
  } catch (err) {
    console.error('resolve-soccer-market Fehler:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
