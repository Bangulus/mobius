import { NextResponse } from 'next/server'
import { getCurrentMatches, getMatchOutcome, OpenLigaMatch } from '@/lib/openligadb'
import {
  XP_WIN, XP_LOSS, XP_REFUND,
  RP_WIN, RP_LOSS, RP_REFUND,
  levelFromXp, titleFromRp,
} from '@/lib/progression'

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
    { headers: adminHeaders(), cache: 'no-store' }
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

async function writePayoutTrade(marketId: string, userId: string, amount: number) {
  await fetch(`${supabaseUrl}/rest/v1/trades`, {
    method: 'POST',
    headers: { ...adminHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({
      market_id: marketId,
      user_id: userId,
      type: 'payout',
      shares: amount,
      cost: amount,
      price_before: 0,
      price_after: 0,
    }),
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

// Progression: XP/RP nach Marktauflösung verbuchen.
// outcome: 'win' (+25 XP/+25 RP), 'loss' (+5 XP/-5 RP), 'refund' (+5 XP/0 RP).
// Fehler hier werden geloggt, blockieren aber nicht den Payout-Flow.
async function awardResolutionXp(userId: string, outcome: 'win' | 'loss' | 'refund', marketId: string) {
  try {
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=xp,rp`,
      { headers: adminHeaders(), cache: 'no-store' }
    )
    if (!userRes.ok) {
      console.error(`awardResolutionXp: users-Abfrage fehlgeschlagen (${userRes.status}) für User ${userId}.`)
      return
    }
    const [u] = await userRes.json()
    if (!u) {
      console.error(`awardResolutionXp: User ${userId} nicht gefunden.`)
      return
    }

    const currentXp: number = u.xp ?? 0
    const currentRp: number = u.rp ?? 0

    let xpDelta = XP_LOSS
    let rpDelta = RP_LOSS
    if (outcome === 'win') { xpDelta = XP_WIN; rpDelta = RP_WIN }
    else if (outcome === 'refund') { xpDelta = XP_REFUND; rpDelta = RP_REFUND }

    const newXp = currentXp + xpDelta
    const newRp = Math.max(0, currentRp + rpDelta)
    const newLevel = levelFromXp(newXp)
    const newTitle = titleFromRp(newRp)

    const patchRes = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...adminHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ xp: newXp, level: newLevel, rp: newRp, title: newTitle }),
    })
    if (!patchRes.ok) {
      console.error(`awardResolutionXp: users-Update fehlgeschlagen (${patchRes.status}) für User ${userId}.`)
      return
    }

    const eventRes = await fetch(`${supabaseUrl}/rest/v1/xp_events`, {
      method: 'POST',
      headers: { ...adminHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: userId,
        type: outcome,
        xp_delta: xpDelta,
        rp_delta: rpDelta,
        market_id: marketId,
      }),
    })
    if (!eventRes.ok) {
      console.error(`awardResolutionXp: xp_events-Insert fehlgeschlagen (${eventRes.status}) für User ${userId}.`)
    }
  } catch (err) {
    console.error('awardResolutionXp: unerwarteter Fehler', err)
  }
}

async function payoutWinners(marketId: string, resolution: 'yes' | 'no' | 'draw') {
  const trades = await getTradesForMarket(marketId)
  if (!trades.length) return

  if (resolution === 'draw') {
    // Refund: alle Buy-Trades werden erstattet, jeder bekommt +5 XP / 0 RP.
    const userRefunds: Record<string, number> = {}
    for (const trade of trades) {
      if (trade.type === 'buy_yes' || trade.type === 'buy_no') {
        userRefunds[trade.user_id] = (userRefunds[trade.user_id] ?? 0) + trade.cost
      }
    }
    for (const [userId, refund] of Object.entries(userRefunds)) {
      const current = await getUserBalance(userId)
      await updateUserBalance(userId, current + refund)
      await writePayoutTrade(marketId, userId, Math.round(refund))
      await awardResolutionXp(userId, 'refund', marketId)
    }
    return
  }

  const winningType = resolution === 'yes' ? 'buy_yes' : 'buy_no'
  const losingType  = resolution === 'yes' ? 'buy_no'  : 'buy_yes'

  const userWinnings: Record<string, number> = {}
  const userLosses: Set<string> = new Set()
  for (const trade of trades) {
    if (trade.type === winningType) {
      userWinnings[trade.user_id] = (userWinnings[trade.user_id] ?? 0) + trade.shares
    } else if (trade.type === losingType) {
      userLosses.add(trade.user_id)
    }
  }

  // Gewinner: Payout + Win-XP/RP
  for (const [userId, winnings] of Object.entries(userWinnings)) {
    const current = await getUserBalance(userId)
    await updateUserBalance(userId, current + winnings)
    await writePayoutTrade(marketId, userId, Math.round(winnings))
    await awardResolutionXp(userId, 'win', marketId)
  }

  // Verlierer: nur Loss-XP/RP, kein Payout
  for (const userId of Array.from(userLosses)) {
    await awardResolutionXp(userId, 'loss', marketId)
  }
}

export async function GET() {
  try {
    const openMarkets = await getOpenSoccerMarkets()
    if (!openMarkets.length) {
      return NextResponse.json({ ok: true, resolved: 0, message: 'Keine offenen Märkte' })
    }

    const matchIds = Array.from(new Set(
      openMarkets.map((m: { match_id: string }) => m.match_id).filter(Boolean)
    )) as string[]

    const allMatches = await getCurrentMatches()

    const matchMap = new Map<string, OpenLigaMatch>()
    for (const match of allMatches) {
      matchMap.set(`bl1-${match.matchID}`, match)
    }

    const missingIds = matchIds.filter(id => !matchMap.has(id))
    if (missingIds.length > 0) {
      const season = new Date().getMonth() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1
      try {
        const res = await fetch(
          `https://api.openligadb.de/getmatchdata/bl1/${season}`,
          { cache: 'no-store' }
        )
        if (res.ok) {
          const seasonMatches: OpenLigaMatch[] = await res.json()
          for (const match of seasonMatches) {
            matchMap.set(`bl1-${match.matchID}`, match)
          }
        }
      } catch {}
    }

    let resolved = 0
    const errors: string[] = []

    for (const market of openMarkets) {
      if (!market.match_id) continue

      const match = matchMap.get(market.match_id)
      if (!match) {
        errors.push(`match-not-found:${market.match_id}`)
        continue
      }

      const outcome = getMatchOutcome(match)
      if (!outcome) continue

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
