import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1'

// Fahrernummern / Namen — Jolpica liefert familyName
const DRIVER_MAP: Record<string, string> = {
  antonelli: 'Antonelli',
  russell:   'Russell',
  leclerc:   'Leclerc',
  bearman:   'Bearman',
  stroll:    'Stroll',
  norris:    'Norris',
  piastri:   'Piastri',
  hamilton:  'Hamilton',
}

async function getLastRaceResults() {
  const year = new Date().getFullYear()
  const res  = await fetch(`${JOLPICA_BASE}/${year}/last/results.json`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  return data?.MRData?.RaceTable?.Races?.[0] ?? null
}

async function getLastQualifyingResults() {
  const year = new Date().getFullYear()
  const res  = await fetch(`${JOLPICA_BASE}/${year}/last/qualifying.json`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  return data?.MRData?.RaceTable?.Races?.[0] ?? null
}

async function getOpenF1Markets(): Promise<any[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/markets?category=eq.formula1&resolved=eq.false&status=eq.open`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }
  )
  return res.ok ? await res.json() : []
}

async function resolveMarket(id: string, resolution: 'yes' | 'no') {
  await fetch(`${SUPABASE_URL}/rest/v1/markets?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      resolved:   true,
      resolution,
      status:     'closed',
    }),
  })
}

async function payoutWinners(marketId: string, resolution: 'yes' | 'no') {
  // Gewinnende Positionen holen
  const field    = resolution === 'yes' ? 'shares_yes' : 'shares_no'
  const posRes   = await fetch(
    `${SUPABASE_URL}/rest/v1/positions?market_id=eq.${marketId}&${field}=gt.0`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }
  )
  if (!posRes.ok) return
  const positions: any[] = await posRes.json()
  if (!positions.length) return

  // Gesamtpool berechnen
  const marketRes = await fetch(
    `${SUPABASE_URL}/rest/v1/markets?id=eq.${marketId}`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    }
  )
  const markets: any[] = await marketRes.json()
  if (!markets.length) return
  const market = markets[0]

  const totalShares = positions.reduce((sum: number, p: any) => sum + p[field], 0)

  for (const pos of positions) {
    const userShares  = pos[field] as number
    const payout      = Math.round((userShares / totalShares) * (market.q_yes + market.q_no) * market.b)
    if (payout <= 0) continue

    // Balance updaten
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${pos.user_id}`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      }
    )
    const profiles: any[] = await profileRes.json()
    if (!profiles.length) continue
    const currentBalance = profiles[0].balance ?? 0

    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${pos.user_id}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ balance: currentBalance + payout }),
    })
  }
}

function driverInTop(results: any[], familyName: string, topN: number): boolean {
  return results.some(
    (r: any) => r.Driver?.familyName === familyName && parseInt(r.position) <= topN
  )
}

function driverPosition(results: any[], familyName: string): number {
  const r = results.find((r: any) => r.Driver?.familyName === familyName)
  return r ? parseInt(r.position) : 999
}

function isClassified(results: any[], familyName: string): boolean {
  return results.some(
    (r: any) => r.Driver?.familyName === familyName && r.status !== 'Retired' && r.status !== 'Accident'
  )
}

export async function POST() {
  try {
    const [raceData, qualiData, openMarkets] = await Promise.all([
      getLastRaceResults(),
      getLastQualifyingResults(),
      getOpenF1Markets(),
    ])

    if (!openMarkets.length) return NextResponse.json({ skipped: 'Keine offenen F1-Märkte' })

    const raceResults: any[]  = raceData?.Results         ?? []
    const qualiResults: any[] = qualiData?.QualifyingResults ?? []
    const raceFinished        = raceResults.length > 0
    const qualiFinished       = qualiResults.length > 0

    const resolved: string[] = []

    for (const market of openMarkets) {
      const label: string = market.short_label ?? ''
      const closesAt      = new Date(market.closes_at)
      const now           = new Date()

      // Noch nicht abgelaufen → überspringen
      if (closesAt > now) continue

      let resolution: 'yes' | 'no' | null = null

      // --- Rennen-Märkte ---
      if (raceFinished) {
        if (label === 'McLaren Podium') {
          const norrisTop3  = driverInTop(raceResults, 'Norris',  3)
          const piastriTop3 = driverInTop(raceResults, 'Piastri', 3)
          resolution = norrisTop3 || piastriTop3 ? 'yes' : 'no'
        }

        if (label === 'Leclerc Top 5') {
          resolution = driverInTop(raceResults, 'Leclerc', 5) ? 'yes' : 'no'
        }

        if (label === 'Bearman Punkte') {
          resolution = driverInTop(raceResults, 'Bearman', 10) ? 'yes' : 'no'
        }

        if (label === 'Stroll Letzter') {
          const classified = raceResults.filter(
            (r: any) => r.status !== 'Retired' && r.status !== 'Accident'
          )
          if (classified.length > 0) {
            const last = classified[classified.length - 1]
            resolution = last.Driver?.familyName === 'Stroll' ? 'yes' : 'no'
          }
        }

        if (label === 'Russell vs Antonelli') {
          const russellOk    = isClassified(raceResults, 'Russell')
          const antonelliOk  = isClassified(raceResults, 'Antonelli')
          if (russellOk && antonelliOk) {
            const rPos = driverPosition(raceResults, 'Russell')
            const aPos = driverPosition(raceResults, 'Antonelli')
            resolution = rPos < aPos ? 'yes' : 'no'
          } else {
            resolution = 'no' // DNF → NEIN
          }
        }
      }

      // --- Qualifying-Märkte ---
      if (qualiFinished && label === 'Ferrari Startreihe 1') {
        const top2 = qualiResults.slice(0, 2)
        const ferrariIn = top2.some(
          (r: any) => r.Driver?.familyName === 'Leclerc' || r.Driver?.familyName === 'Hamilton'
        )
        resolution = ferrariIn ? 'yes' : 'no'
      }

      // Auflösen + Auszahlen
      if (resolution) {
        await resolveMarket(market.id, resolution)
        await payoutWinners(market.id, resolution)
        resolved.push(`${label} → ${resolution}`)
      }
    }

    return NextResponse.json({ ok: true, resolved })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
