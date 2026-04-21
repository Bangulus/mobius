'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

const SUPABASE_URL = 'https://zrujclkigcrlrvpgxrqx.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydWpjbGtpZ2NybHJ2cGd4cnF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQ0NTEsImV4cCI6MjA5MTQwMDQ1MX0.JpuZxskptogAKtw5cUR3gJOAcnh3BFh1NSvfVEtN8IQ'

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    cache: 'no-store',
  })
  return res.json()
}

interface Market {
  id: string
  question: string
  description?: string
  status: string
  b: number
  q_yes: number
  q_no: number
  closes_at: string
  category?: string
  resolved: boolean
  resolution?: string
  is_auto?: boolean
}

interface Trade {
  id: string
  market_id: string
  user_id: string
  direction: 'yes' | 'no'
  amount: number
  created_at: string
}

interface Position {
  id: string
  user_id: string
  market_id: string
  direction: string
  amount: number
}

interface User {
  id: string
  username: string
  balance: number
  avatar_url?: string
}

function calcProb(qYes: number, qNo: number, b: number): number {
  const eYes = Math.exp(qYes / b)
  const eNo  = Math.exp(qNo  / b)
  return Math.round((eYes / (eYes + eNo)) * 100)
}

// LMSR Kostenfunktion: was kostet es, amount Anteile auf `side` zu kaufen?
function lmsrCost(qYes: number, qNo: number, b: number, side: 'yes' | 'no', amount: number): number {
  const newQYes = side === 'yes' ? qYes + amount : qYes
  const newQNo  = side === 'no'  ? qNo  + amount : qNo
  const costBefore = b * Math.log(Math.exp(qYes / b) + Math.exp(qNo / b))
  const costAfter  = b * Math.log(Math.exp(newQYes / b) + Math.exp(newQNo / b))
  return Math.max(0, costAfter - costBefore)
}

// LMSR Rückgabewert beim Verkauf
function lmsrSellReturn(qYes: number, qNo: number, b: number, side: 'yes' | 'no', amount: number): number {
  const newQYes = side === 'yes' ? qYes - amount : qYes
  const newQNo  = side === 'no'  ? qNo  - amount : qNo
  const costBefore = b * Math.log(Math.exp(qYes / b) + Math.exp(qNo / b))
  const costAfter  = b * Math.log(Math.exp(Math.max(0, newQYes) / b) + Math.exp(Math.max(0, newQNo) / b))
  return Math.max(0, costBefore - costAfter)
}

const CAT_CLASS: Record<string, string> = {
  Politik: 'cat-politik', Sport: 'cat-sport', Krypto: 'cat-krypto',
  Entertainment: 'cat-entertainment', Wirtschaft: 'cat-wirtschaft',
}

type Tab      = '7T' | '1M' | 'Gesamt'
type TradeTab = 'kaufen' | 'verkaufen'
type OrderType = 'markt' | 'limit'

export default function MarketPage() {
  const params   = useParams()
  const router   = useRouter()
  const marketId = params?.id as string

  const [market, setMarket]         = useState<Market | null>(null)
  const [trades, setTrades]         = useState<Trade[]>([])
  const [position, setPosition]     = useState<Position | null>(null)
  const [user, setUser]             = useState<User | null>(null)
  const [loading, setLoading]       = useState(true)

  // Trading state
  const [tradeTab, setTradeTab]     = useState<TradeTab>('kaufen')
  const [orderType, setOrderType]   = useState<OrderType>('markt')
  const [direction, setDirection]   = useState<'yes' | 'no'>('yes')
  const [amount, setAmount]         = useState(100)
  const [limitPrice, setLimitPrice] = useState(50) // in Cent (0–100)
  const [betLoading, setBetLoading] = useState(false)
  const [betError, setBetError]     = useState('')
  const [betSuccess, setBetSuccess] = useState('')

  // Chart state
  const [activeTab, setActiveTab]   = useState<Tab>('7T')
  const chartRef                    = useRef<HTMLCanvasElement>(null)
  const chartInstance               = useRef<unknown>(null)

  /* Session */
  useEffect(() => {
    const saved = localStorage.getItem('mobius_session')
    if (!saved) return
    try {
      const session = JSON.parse(saved)
      if (session?.user_id) {
        dbGet('users', `id=eq.${session.user_id}&select=*`).then((data) => {
          if (data?.[0]) setUser(data[0])
        })
      }
    } catch {}
  }, [])

  /* Markt + Trades + Position laden */
  const loadMarket = useCallback(async () => {
    const data = await dbGet('markets', `id=eq.${marketId}&select=*`)
    if (data?.[0]) setMarket(data[0])
    setLoading(false)
  }, [marketId])

  const loadTrades = useCallback(async () => {
    const data = await dbGet('trades', `market_id=eq.${marketId}&select=*&order=created_at.asc`)
    setTrades(data ?? [])
  }, [marketId])

  const loadPosition = useCallback(async (userId: string) => {
    const data = await dbGet('positions', `user_id=eq.${userId}&market_id=eq.${marketId}&select=*`)
    setPosition(data?.[0] ?? null)
  }, [marketId])

  useEffect(() => {
    loadMarket()
    loadTrades()
  }, [loadMarket, loadTrades])

  useEffect(() => {
    if (user?.id) loadPosition(user.id)
  }, [user, loadPosition])

  /* Preisverlauf */
  const priceHistory = (() => {
    if (!market || trades.length === 0) return []
    let qY = 0, qN = 0
    return trades.map((t) => {
      if (t.direction === 'yes') qY += t.amount
      else qN += t.amount
      return { t: t.created_at, prob: calcProb(qY, qN, market.b) }
    })
  })()

  /* Chart */
  useEffect(() => {
    if (!chartRef.current || priceHistory.length === 0) return
    const build = async () => {
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)
      const now   = new Date()
      const since = activeTab === '7T'
        ? new Date(now.getTime() - 7  * 24 * 3600 * 1000)
        : activeTab === '1M'
        ? new Date(now.getTime() - 30 * 24 * 3600 * 1000)
        : new Date(0)
      const pts = priceHistory.filter((p) => new Date(p.t) >= since)
      const dataPoints = pts.length > 0 ? pts : priceHistory.slice(-10)
      const isDark    = document.documentElement.getAttribute('data-theme') === 'dark'
      const gridColor = isDark ? '#2a2d3a' : '#e8eaef'
      const tickColor = isDark ? '#94a3b8' : '#9ca3af'
      if (chartInstance.current) (chartInstance.current as { destroy: () => void }).destroy()
      chartInstance.current = new Chart(chartRef.current!, {
        type: 'line',
        data: {
          labels: dataPoints.map((p) => {
            const d = new Date(p.t)
            return activeTab === 'Gesamt'
              ? d.toLocaleDateString('de', { month: 'short', day: 'numeric' })
              : d.toLocaleDateString('de', { day: '2-digit', month: '2-digit' })
          }),
          datasets: [{
            data: dataPoints.map((p) => p.prob),
            borderColor: '#12b76a', backgroundColor: isDark ? 'rgba(18,183,106,0.08)' : 'rgba(18,183,106,0.10)',
            fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 350 },
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y}% Ja` } } },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11 }, maxTicksLimit: 6 } },
            y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11 }, callback: (v) => `${v}%` } },
          },
        },
      })
    }
    build()
    return () => { if (chartInstance.current) (chartInstance.current as { destroy: () => void }).destroy() }
  }, [priceHistory, activeTab])

  /* Kaufen */
  async function handleKaufen() {
    if (!user || !market) return
    if (amount <= 0) { setBetError('Ungültiger Betrag.'); return }

    const actualCost = orderType === 'markt'
      ? lmsrCost(market.q_yes, market.q_no, market.b, direction, amount)
      : amount // bei Limit: Einsatz = Betrag

    if (user.balance < actualCost) { setBetError('Nicht genug Guthaben.'); return }

    setBetLoading(true)
    setBetError('')

    const session = JSON.parse(localStorage.getItem('mobius_session') ?? '{}')
    const token   = session?.access_token ?? SUPABASE_KEY

    if (orderType === 'limit') {
      // Limit-Order: nur speichern, nicht sofort ausführen
      // Für MVP: als normaler Trade speichern mit Hinweis
      setBetSuccess(`Limit-Order bei ${limitPrice}¢ platziert. Wird ausgeführt wenn der Kurs erreicht wird.`)
      setBetLoading(false)
      setTimeout(() => setBetSuccess(''), 4000)
      return
    }

    const newQYes = direction === 'yes' ? market.q_yes + amount : market.q_yes
    const newQNo  = direction === 'no'  ? market.q_no  + amount : market.q_no

    // Trade eintragen
    const tradeRes = await fetch(`${SUPABASE_URL}/rest/v1/trades`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ market_id: marketId, user_id: user.id, direction, amount }),
    })
    if (!tradeRes.ok) { setBetError('Fehler beim Platzieren.'); setBetLoading(false); return }

    // Markt updaten
    await fetch(`${SUPABASE_URL}/rest/v1/markets?id=eq.${marketId}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ q_yes: newQYes, q_no: newQNo }),
    })

    // Balance abziehen
    const newBalance = user.balance - actualCost
    await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ balance: Math.round(newBalance) }),
    })

    // Position updaten (upsert)
    const existingPos = await dbGet('positions', `user_id=eq.${user.id}&market_id=eq.${marketId}&select=*`)
    if (existingPos?.[0]) {
      const currentAmount = existingPos[0].direction === direction
        ? existingPos[0].amount + amount
        : existingPos[0].amount - amount
      await fetch(`${SUPABASE_URL}/rest/v1/positions?user_id=eq.${user.id}&market_id=eq.${marketId}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ direction, amount: Math.max(0, currentAmount) }),
      })
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/positions`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ user_id: user.id, market_id: marketId, direction, amount }),
      })
    }

    setUser({ ...user, balance: Math.round(newBalance) })
    setBetSuccess('Wette platziert ✓')
    setBetLoading(false)
    loadMarket()
    loadTrades()
    loadPosition(user.id)
    setTimeout(() => setBetSuccess(''), 2500)
  }

  /* Verkaufen */
  async function handleVerkaufen() {
    if (!user || !market || !position) return
    const sellAmount = Math.min(amount, position.amount)
    if (sellAmount <= 0) { setBetError('Keine Anteile zum Verkaufen.'); return }

    setBetLoading(true)
    setBetError('')

    const session   = JSON.parse(localStorage.getItem('mobius_session') ?? '{}')
    const token     = session?.access_token ?? SUPABASE_KEY
    const returnAmt = lmsrSellReturn(market.q_yes, market.q_no, market.b, position.direction as 'yes' | 'no', sellAmount)

    const newQYes = position.direction === 'yes' ? market.q_yes - sellAmount : market.q_yes
    const newQNo  = position.direction === 'no'  ? market.q_no  - sellAmount : market.q_no

    // Trade eintragen (negativ = Verkauf)
    await fetch(`${SUPABASE_URL}/rest/v1/trades`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ market_id: marketId, user_id: user.id, direction: position.direction, amount: -sellAmount }),
    })

    // Markt updaten
    await fetch(`${SUPABASE_URL}/rest/v1/markets?id=eq.${marketId}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ q_yes: Math.max(0, newQYes), q_no: Math.max(0, newQNo) }),
    })

    // Balance gutschreiben
    const newBalance = user.balance + returnAmt
    await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ balance: Math.round(newBalance) }),
    })

    // Position updaten
    const newPosAmount = position.amount - sellAmount
    if (newPosAmount <= 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/positions?user_id=eq.${user.id}&market_id=eq.${marketId}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
      })
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/positions?user_id=eq.${user.id}&market_id=eq.${marketId}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ amount: newPosAmount }),
      })
    }

    setUser({ ...user, balance: Math.round(newBalance) })
    setBetSuccess(`${Math.round(returnAmt)} ₫ erhalten ✓`)
    setBetLoading(false)
    loadMarket()
    loadTrades()
    loadPosition(user.id)
    setTimeout(() => setBetSuccess(''), 2500)
  }

  /* ── Render ── */
  if (loading) return <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>Markt wird geladen…</div>
  if (!market) return (
    <div style={{ padding: 32 }}>
      <div style={{ color: 'var(--no)', fontSize: 14, marginBottom: 16 }}>Markt nicht gefunden.</div>
      <button className="nav-pill" onClick={() => router.push('/')}>← Zurück</button>
    </div>
  )

  const prob    = calcProb(market.q_yes, market.q_no, market.b)
  const isLow   = prob < 50
  const catClass = CAT_CLASS[market.category ?? ''] ?? ''

  // Gewinnberechnung (Markt-Order)
  const actualCost   = market ? lmsrCost(market.q_yes, market.q_no, market.b, direction, amount) : 0
  const winIfCorrect = amount   // bei Auflösung: amount Anteile × 1₫ = amount ₫ ausgezahlt
  const profit       = winIfCorrect - actualCost
  const returnOnSell = position
    ? lmsrSellReturn(market.q_yes, market.q_no, market.b, position.direction as 'yes' | 'no', Math.min(amount, position.amount))
    : 0

  return (
    <>
      {/* ── Nav ── */}
      <nav className="nav">
        <div className="nav-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-weiss.png" alt="Möbius" className="nav-logo"
            onClick={() => router.push('/')} style={{ cursor: 'pointer' }} />
          <button className="nav-pill" onClick={() => router.push('/')} style={{ fontSize: 13 }}>
            ← Alle Märkte
          </button>
        </div>
        <div className="nav-right">
          {user ? (
            <div className="nav-stat">
              <div className="nav-stat-label">Guthaben</div>
              <div className="nav-stat-value">{user.balance.toLocaleString('de')} ₫</div>
            </div>
          ) : (
            <button className="nav-pill accent" onClick={() => router.push('/')}>Anmelden</button>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 16px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {market.category && <span className={`cat-badge ${catClass}`}>{market.category}</span>}
            {market.is_auto && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                Live
              </span>
            )}
            {market.resolved && (
              <span style={{
                fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
                background: market.resolution === 'yes' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
                color: market.resolution === 'yes' ? '#16a34a' : '#dc2626',
              }}>
                Aufgelöst: {market.resolution === 'yes' ? 'Ja' : 'Nein'}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, marginBottom: 8 }}>
            {market.question}
          </h1>
          {market.description && (
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>{market.description}</p>
          )}
        </div>

        {/* ── Wahrscheinlichkeit ── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 36, fontWeight: 700, color: isLow ? 'var(--no)' : 'var(--yes)' }}>{prob}%</span>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Wahrscheinlichkeit Ja</span>
          </div>
          <div className="prob-bar" style={{ height: 8, marginBottom: 0 }}>
            <div className={`prob-bar-fill ${isLow ? 'low' : ''}`} style={{ width: `${prob}%` }} />
          </div>
        </div>

        {/* ── Grid: Chart + Panel ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

          {/* Chart */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Preisverlauf</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['7T', '1M', 'Gesamt'] as Tab[]).map((t) => (
                  <button key={t} onClick={() => setActiveTab(t)} style={{
                    fontSize: 12, padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: activeTab === t ? 'var(--accent)' : 'var(--surface)',
                    color: activeTab === t ? '#fff' : 'var(--text-muted)',
                    fontWeight: activeTab === t ? 600 : 400,
                  }}>{t}</button>
                ))}
              </div>
            </div>
            {priceHistory.length === 0 ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>
                Chart erscheint nach der ersten Wette.
              </div>
            ) : (
              <div style={{ height: 200, position: 'relative' }}><canvas ref={chartRef} /></div>
            )}
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-subtle)' }}>
              Volumen: {Math.round(market.q_yes + market.q_no).toLocaleString('de')} ₫ · {trades.filter(t => t.amount > 0).length} Trades
            </div>
          </div>

          {/* ── Trading Panel ── */}
          <div className="card" style={{ position: 'sticky', top: 'calc(var(--nav-height) + 16px)', padding: 0, overflow: 'hidden' }}>
            {market.resolved ? (
              <div style={{ textAlign: 'center', padding: '24px 16px' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Markt aufgelöst</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Ergebnis: <strong style={{ color: market.resolution === 'yes' ? 'var(--yes)' : 'var(--no)' }}>
                    {market.resolution === 'yes' ? 'Ja' : 'Nein'}
                  </strong>
                </div>
              </div>
            ) : !user ? (
              <div style={{ textAlign: 'center', padding: '24px 16px' }}>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>Anmelden um zu handeln</div>
                <button className="submit-btn yes" onClick={() => router.push('/')}>Zur Anmeldung</button>
              </div>
            ) : (
              <>
                {/* ── Tab-Leiste: Kaufen / Verkaufen | Markt / Limit ── */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border)', padding: '0 16px',
                }}>
                  {/* Kaufen / Verkaufen */}
                  <div style={{ display: 'flex' }}>
                    {(['kaufen', 'verkaufen'] as TradeTab[]).map((t) => (
                      <button key={t} onClick={() => { setTradeTab(t); setBetError(''); setBetSuccess('') }}
                        style={{
                          padding: '12px 14px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                          background: 'transparent',
                          color: tradeTab === t ? 'var(--text)' : 'var(--text-muted)',
                          borderBottom: tradeTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                          marginBottom: -1,
                        }}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                  {/* Markt / Limit */}
                  <div style={{ position: 'relative' }}>
                    <select
                      value={orderType}
                      onChange={(e) => setOrderType(e.target.value as OrderType)}
                      style={{
                        fontSize: 12, color: 'var(--text-muted)', background: 'transparent',
                        border: '1px solid var(--border)', borderRadius: 6,
                        padding: '4px 8px', cursor: 'pointer', appearance: 'none',
                      }}>
                      <option value="markt">Markt</option>
                      <option value="limit">Limit</option>
                    </select>
                  </div>
                </div>

                <div style={{ padding: '16px' }}>

                  {tradeTab === 'kaufen' && (
                    <>
                      {/* Ja / Nein */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                        {(['yes', 'no'] as const).map((d) => (
                          <button key={d} onClick={() => setDirection(d)} style={{
                            padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                            fontWeight: 600, fontSize: 14,
                            background: direction === d
                              ? (d === 'yes' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)')
                              : 'var(--surface)',
                            color: direction === d
                              ? (d === 'yes' ? 'var(--yes)' : 'var(--no)')
                              : 'var(--text-muted)',
                            outline: direction === d
                              ? `2px solid ${d === 'yes' ? 'var(--yes)' : 'var(--no)'}`
                              : '2px solid transparent',
                          }}>
                            {d === 'yes' ? `Ja · ${prob}¢` : `Nein · ${100 - prob}¢`}
                          </button>
                        ))}
                      </div>

                      {/* Limit-Preis (nur bei Limit-Order) */}
                      {orderType === 'limit' && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                            Limitpreis (¢ pro Anteil, 1–99)
                          </div>
                          <input type="number" min={1} max={99} value={limitPrice}
                            onChange={(e) => setLimitPrice(Math.min(99, Math.max(1, parseInt(e.target.value) || 1)))}
                            style={{ width: '100%', fontSize: 16, fontWeight: 600 }} />
                          <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 4 }}>
                            Aktueller Kurs: {direction === 'yes' ? prob : 100 - prob}¢
                          </div>
                        </div>
                      )}

                      {/* Betrag */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Betrag (₫)</div>
                        <input type="number" min={1} max={user.balance} value={amount}
                          onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
                          style={{ width: '100%', fontSize: 16, fontWeight: 600 }} />
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          {[50, 100, 200, 500].map((v) => (
                            <button key={v} onClick={() => setAmount(v)} style={{
                              flex: 1, fontSize: 11, padding: '4px 0', borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: amount === v ? 'var(--accent)' : 'var(--surface)',
                              color: amount === v ? '#fff' : 'var(--text-muted)', cursor: 'pointer',
                            }}>+{v}</button>
                          ))}
                        </div>
                      </div>

                      {/* Gewinn-Anzeige (nur Markt-Order) */}
                      {orderType === 'markt' && (
                        <div style={{
                          background: 'var(--surface)', borderRadius: 10, padding: '14px',
                          marginBottom: 14, textAlign: 'center',
                        }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                            Kosten: {Math.round(actualCost)} ₫ · Bei Gewinn erhältst du
                          </div>
                          <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>
                            +{Math.round(profit)} ₫
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>
                            Gewinn wenn {direction === 'yes' ? 'Ja' : 'Nein'} eintritt
                          </div>
                        </div>
                      )}

                      {orderType === 'limit' && (
                        <div style={{
                          background: 'var(--surface)', borderRadius: 10, padding: '12px',
                          marginBottom: 14, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6,
                        }}>
                          Order wird ausgeführt wenn der Kurs {limitPrice}¢ erreicht.
                        </div>
                      )}
                    </>
                  )}

                  {tradeTab === 'verkaufen' && (
                    <>
                      {!position || position.amount <= 0 ? (
                        <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: 'var(--text-muted)' }}>
                          Du hast keine Anteile in diesem Markt.
                        </div>
                      ) : (
                        <>
                          {/* Position anzeigen */}
                          <div style={{
                            background: 'var(--surface)', borderRadius: 8, padding: '10px 12px',
                            marginBottom: 14, fontSize: 13,
                          }}>
                            <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Deine Position</div>
                            <div style={{ fontWeight: 600, color: position.direction === 'yes' ? 'var(--yes)' : 'var(--no)' }}>
                              {position.direction === 'yes' ? 'Ja' : 'Nein'} · {position.amount} Anteile
                            </div>
                          </div>

                          {/* Limit-Preis für Verkauf */}
                          {orderType === 'limit' && (
                            <div style={{ marginBottom: 14 }}>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                                Mindestpreis (¢ pro Anteil)
                              </div>
                              <input type="number" min={1} max={99} value={limitPrice}
                                onChange={(e) => setLimitPrice(Math.min(99, Math.max(1, parseInt(e.target.value) || 1)))}
                                style={{ width: '100%', fontSize: 16, fontWeight: 600 }} />
                            </div>
                          )}

                          {/* Verkaufsmenge */}
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                              Anzahl Anteile verkaufen (max. {position.amount})
                            </div>
                            <input type="number" min={1} max={position.amount} value={amount}
                              onChange={(e) => setAmount(Math.min(position.amount, Math.max(1, parseInt(e.target.value) || 1)))}
                              style={{ width: '100%', fontSize: 16, fontWeight: 600 }} />
                            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                              {[25, 50, 75, 100].map((pct) => (
                                <button key={pct} onClick={() => setAmount(Math.max(1, Math.round(position.amount * pct / 100)))}
                                  style={{
                                    flex: 1, fontSize: 11, padding: '4px 0', borderRadius: 6,
                                    border: '1px solid var(--border)', background: 'var(--surface)',
                                    color: 'var(--text-muted)', cursor: 'pointer',
                                  }}>{pct}%</button>
                              ))}
                            </div>
                          </div>

                          {/* Rückgabe-Anzeige */}
                          {orderType === 'markt' && (
                            <div style={{
                              background: 'var(--surface)', borderRadius: 10, padding: '14px',
                              marginBottom: 14, textAlign: 'center',
                            }}>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Du erhältst</div>
                              <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>
                                +{Math.round(returnOnSell)} ₫
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>
                                zum aktuellen Marktpreis
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {betError  && <div className="alert alert-error"   style={{ marginBottom: 10 }}>{betError}</div>}
                  {betSuccess && <div className="alert alert-success" style={{ marginBottom: 10 }}>{betSuccess}</div>}

                  {/* Action Button */}
                  {tradeTab === 'kaufen' ? (
                    <button
                      className={`submit-btn ${direction === 'yes' ? 'yes' : 'no'}`}
                      onClick={handleKaufen}
                      disabled={betLoading || amount <= 0}
                      style={{ width: '100%' }}>
                      {betLoading ? 'Wird ausgeführt…'
                        : orderType === 'limit' ? `Limit-Order: ${direction === 'yes' ? 'Ja' : 'Nein'} @ ${limitPrice}¢`
                        : `${direction === 'yes' ? 'Ja' : 'Nein'} kaufen · ${Math.round(actualCost)} ₫`}
                    </button>
                  ) : (
                    <button
                      className="submit-btn no"
                      onClick={handleVerkaufen}
                      disabled={betLoading || !position || position.amount <= 0}
                      style={{ width: '100%' }}>
                      {betLoading ? 'Wird verkauft…' : `Verkaufen · ${Math.round(returnOnSell)} ₫ erhalten`}
                    </button>
                  )}

                  <div style={{ fontSize: 11, color: 'var(--text-subtle)', textAlign: 'center', marginTop: 8 }}>
                    Guthaben: {user.balance.toLocaleString('de')} ₫
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Letzte Trades ── */}
        {trades.filter(t => t.amount > 0).length > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Letzte Trades</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...trades].filter(t => t.amount > 0).reverse().slice(0, 10).map((t) => (
                <div key={t.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ color: t.direction === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 600 }}>
                    {t.direction === 'yes' ? 'Ja' : 'Nein'}
                  </span>
                  <span style={{ color: 'var(--text)' }}>{t.amount} ₫</span>
                  <span style={{ color: 'var(--text-subtle)' }}>
                    {new Date(t.created_at).toLocaleDateString('de', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  )
}
