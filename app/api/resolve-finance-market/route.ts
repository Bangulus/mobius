import { NextResponse } from 'next/server'
import { finnhubQuote } from '@/lib/finnhub'
import { XP_WIN, XP_LOSS, RP_WIN, RP_LOSS, levelFromXp, titleFromRp } from '@/lib/progression'

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

// Progression: Gewinn/Verlust-XP + RP nach Marktauflösung verbuchen.
// Fehler hier werden geloggt, blockieren aber nicht den Payout-Flow.
async function awardResolutionXp(userId: string, won: boolean, marketId: string) {
  try {
    const userRes = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=xp,rp`,
      { headers: getAdminHeaders(), cache: 'no-store' }
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

    const xpDelta = won ? XP_WIN : XP_LOSS
    const rpDelta = won ? RP_WIN : RP_LOSS

    const newXp = currentXp + xpDelta
    const newRp = Math.max(0, currentRp + rpDelta)
    const newLevel = levelFromXp(newXp)
    const newTitle = titleFromRp(newRp)

    const patchRes = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...getAdminHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ xp: newXp, level: newLevel, rp: newRp, title: newTitle }),
    })
    if (!patchRes.ok) {
      console.error(`awardResolutionXp: users-Update fehlgeschlagen (${patchRes.status}) für User ${userId}.`)
      return
    }

    const eventRes = await fetch(`${supabaseUrl}/rest/v1/xp_events`, {
      method: 'POST',
      headers: { ...getAdminHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: userId,
        type: won ? 'win' : 'loss',
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

async function payoutWinners(marketId: string, resolution: 'yes' | 'no') {
  const posRes = await fetch(
    `${supabaseUrl}/rest/v1/positions?market_id=eq.${marketId}&select=user_id,shares_yes,shares_no`,
    { headers: getAdminHeaders(), cache: 'no-store' }
  )
  if (!posRes.ok) return
  const positions = await posRes.json()
  for (const pos of positions) {
    if (!pos.user_id) continue

    const winShares  = resolution === 'yes' ? (pos.shares_yes ?? 0) : (pos.shares_no ?? 0)
    const loseShares = resolution === 'yes' ? (pos.shares_no  ?? 0) : (pos.shares_yes ?? 0)

    // Gewinner-Seite: Payout + Win-XP/RP
    if (winShares > 0) {
      const payout = Math.floor(winShares)
      const balRes = await fetch(
        `${supabaseUrl}/rest/v1/users?id=eq.${pos.user_id}&select=balance`,
        { headers: getAdminHeaders(), cache: 'no-store' }
      )
      if (balRes.ok) {
        const [user] = await balRes.json()
        if (user) {
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
            await awardResolutionXp(pos.user_id, true, marketId)
          }
        }
      }
    }

    // Verlierer-Seite: nur Loss-XP/RP, kein Payout
    if (loseShares > 0) {
      await awardResolutionXp(pos.user_id, false, marketId)
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
