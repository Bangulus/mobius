'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'

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
  coin?: string
  start_price?: number
  end_price?: number
}

interface Trade {
  id: string
  created_at: string
  direction: string
  amount: number
  user_id: string
}

type Tab = '7T' | '1M' | 'Gesamt'

function calcProb(qYes: number, qNo: number, b: number): number {
  const eYes = Math.exp(qYes / b)
  const eNo  = Math.exp(qNo  / b)
  return Math.round((eYes / (eYes + eNo)) * 100)
}

const CAT_CLASS: Record<string, string> = {
  Politik:       'cat-politik',
  Sport:         'cat-sport',
  Krypto:        'cat-krypto',
  Entertainment: 'cat-entertainment',
  Wirtschaft:    'cat-wirtschaft',
}

export default function MarketDetailPage() {
  const router       = useRouter()
  const params       = useParams()
  const searchParams = useSearchParams()
  const marketId     = params.id as string
  const userId       = searchParams.get('token') ?? ''
  const token        = userId ? `?token=${userId}` : ''

  const [market, setMarket]   = useState<Market | null>(null)
  const [trades, setTrades]   = useState<Trade[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('7T')
  const [direction, setDirection] = useState<'yes' | 'no'>('yes')
  const [amount, setAmount]   = useState(100)
  const [loading, setLoading] = useState(true)
  const [betLoading, setBetLoading] = useState(false)
  const [betSuccess, setBetSuccess] = useState(false)
  const [betError, setBetError] = useState<string | null>(null)
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<unknown>(null)

  const loadMarket = useCallback(async () => {
    const data = await dbGet('markets', `id=eq.${marketId}&select=*`)
    if (data?.[0]) setMarket(data[0])
    setLoading(false)
  }, [marketId])

  const loadTrades = useCallback(async () => {
    const data = await dbGet('trades', `market_id=eq.${marketId}&select=*&order=created_at.asc`)
    setTrades(data ?? [])
  }, [marketId])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMarket() }, [marketId])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadTrades() }, [marketId])

  useEffect(() => {
    if (!chartRef.current || trades.length === 0 || !market) return

    const buildChart = async () => {
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)

      const now = new Date()
      const since = activeTab === '7T'
        ? new Date(now.getTime() - 7  * 24 * 3600 * 1000)
        : activeTab === '1M'
        ? new Date(now.getTime() - 30 * 24 * 3600 * 1000)
        : new Date(0)

      let qY = 0, qN = 0
      const points = trades
        .filter((t) => new Date(t.created_at) >= since)
        .map((t) => {
          if (t.direction === 'yes') qY += t.amount
          else qN += t.amount
          return { t: t.created_at, prob: calcProb(qY, qN, market.b) }
        })

      const dataPoints = points.length > 0 ? points : [{ t: new Date().toISOString(), prob: calcProb(market.q_yes, market.q_no, market.b) }]

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
      const gridColor = isDark ? '#2a2d3a' : '#e8eaef'
      const tickColor = isDark ? '#94a3b8' : '#9ca3af'

      if (chartInstance.current) {
        (chartInstance.current as { destroy: () => void }).destroy()
      }

      chartInstance.current = new Chart(chartRef.current!, {
        type: 'line',
        data: {
          labels: dataPoints.map((p) => {
            const d = new Date(p.t)
            return d.toLocaleDateString('de', { day: '2-digit', month: '2-digit' })
          }),
          datasets: [{
            data: dataPoints.map((p) => p.prob),
            borderColor: '#12b76a',
            backgroundColor: isDark ? 'rgba(18,183,106,0.08)' : 'rgba(18,183,106,0.10)',
            fill: true,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 350 },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y}% Ja` } },
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11 }, maxTicksLimit: 6 } },
            y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11 }, callback: (v) => `${v}%` } },
          },
        },
      })
    }

    buildChart()

    return () => {
      if (chartInstance.current) {
        (chartInstance.current as { destroy: () => void }).destroy()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, activeTab, market?.b])

  const quickAmounts = [50, 100, 250, 500]
  const prob = market ? calcProb(market.q_yes, market.q_no, market.b) : 50
  const betProb = direction === 'yes' ? prob / 100 : 1 - prob / 100
  const quote = betProb > 0 ? parseFloat((1 / betProb).toFixed(2)) : 0
  const potentialWin = Math.round(amount * quote - amount)

  const handleBet = async () => {
    if (!userId) { setBetError('Bitte zuerst anmelden.'); return }
    setBetLoading(true)
    setBetError(null)

    const userData = await dbGet('users', `id=eq.${userId}&select=balance`)
    const balance = userData?.[0]?.balance ?? 0
    if (balance < amount) { setBetError('Nicht genug Dukaten.'); setBetLoading(false); return }

    const newQYes = direction === 'yes' ? (market?.q_yes ?? 0) + amount : (market?.q_yes ?? 0)
    const newQNo  = direction === 'no'  ? (market?.q_no  ?? 0) + amount : (market?.q_no  ?? 0)

    const tradeRes = await fetch(`${SUPABASE_URL}/rest/v1/trades`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ market_id: marketId, user_id: userId, direction, amount }),
    })

    if (!tradeRes.ok) { setBetError('Fehler beim Platzieren.'); setBetLoading(false); return }

    await fetch(`${SUPABASE_URL}/rest/v1/markets?id=eq.${marketId}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ q_yes: newQYes, q_no: newQNo }),
    })

    await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ balance: balance - amount }),
    })

    setBetSuccess(true)
    setBetLoading(false)
    loadMarket()
    loadTrades()
    setTimeout(() => setBetSuccess(false), 2000)
  }

  if (loading) return (
    <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 14 }}>Markt wird geladen…</div>
  )

  if (!market) return (
    <div style={{ padding: 24, color: 'var(--no)', fontSize: 14 }}>Markt nicht gefunden.</div>
  )

  const isLow = prob < 50
  const catClass = CAT_CLASS[market.category ?? ''] ?? ''
  const closes = new Date(market.closes_at).toLocaleDateString('de', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <>
      <nav className="nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="nav-logo">
            <div className="nav-logo-mark"><div className="nav-logo-inner" /></div>
            Möbius
          </div>
          <button className="nav-btn" onClick={() => router.push(`/${token}`)} style={{ fontSize: 12 }}>
            ← Märkte
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="nav-btn" onClick={() => router.push(`/${token}`)}>Portfolio</button>
        </div>
      </nav>

      <main className="page-container-narrow">

        <div className="market-header-card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              {market.category && (
                <div style={{ marginBottom: 8 }}>
                  <span className={`cat-badge ${catClass}`}>{market.category}</span>
                </div>
              )}
              <h1 className="market-question-title">{market.question}</h1>
              {market.description && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.55 }}>
                  {market.description}
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div className={`market-prob-display ${isLow ? 'low' : ''}`}>{prob}%</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>Ja-Wahrscheinlichkeit</div>
            </div>
          </div>

          <div className="prob-bar" style={{ height: 5, marginBottom: 14 }}>
            <div className={`prob-bar-fill ${isLow ? 'low' : ''}`} style={{ width: `${prob}%` }} />
          </div>

          <div className="market-meta-row">
            <div className="market-meta-item">
              <div className="market-meta-label">Volumen</div>
              <div className="market-meta-value">{Math.round(market.q_yes + market.q_no).toLocaleString('de')} ₫</div>
            </div>
            <div className="market-meta-item">
              <div className="market-meta-label">Trades</div>
              <div className="market-meta-value">{trades.length}</div>
            </div>
            <div className="market-meta-item">
              <div className="market-meta-label">Schließt</div>
              <div className="market-meta-value">{closes}</div>
            </div>
            <div className="market-meta-item">
              <div className="market-meta-label">Status</div>
              <div className="market-meta-value">
                {market.resolved ? (
                  <span style={{ color: 'var(--text-muted)' }}>
                    Aufgelöst: {market.resolution === 'yes' ? 'Ja' : 'Nein'}
                  </span>
                ) : (
                  <>{market.is_auto && <span className="live-dot" style={{ marginRight: 4 }} />}Offen</>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="detail-layout">
          <div>
            <div className="chart-card">
              <div className="chart-header">
                <div className="section-title">Wahrscheinlichkeitsverlauf</div>
                <div className="chart-tabs">
                  {(['7T', '1M', 'Gesamt'] as Tab[]).map((tab) => (
                    <button
                      key={tab}
                      className={`chart-tab ${activeTab === tab ? 'active' : ''}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ height: 180, position: 'relative' }}>
                {trades.length === 0 ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--text-subtle)' }}>
                    Noch keine Handelsdaten
                  </div>
                ) : (
                  <canvas ref={chartRef} style={{ width: '100%', height: '100%' }} />
                )}
              </div>
            </div>

            {market.description && (
              <div className="card">
                <div className="section-title" style={{ marginBottom: 10 }}>Details</div>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>{market.description}</p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!market.resolved ? (
              <div className="trading-panel">
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 14 }}>Handeln</div>

                <div className="direction-toggle">
                  <button className={`dir-btn ${direction === 'yes' ? 'active-yes' : ''}`} onClick={() => setDirection('yes')}>
                    Ja · {prob}%
                  </button>
                  <button className={`dir-btn ${direction === 'no' ? 'active-no' : ''}`} onClick={() => setDirection('no')}>
                    Nein · {100 - prob}%
                  </button>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Einsatz in Dukaten (₫)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <input
                    type="number"
                    value={amount}
                    min={1}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>₫</span>
                </div>

                <div className="quick-amounts">
                  {quickAmounts.map((q) => (
                    <button key={q} className="quick-btn"
                      style={amount === q ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
                      onClick={() => setAmount(q)}>
                      {q}
                    </button>
                  ))}
                </div>

                <hr className="divider" style={{ margin: '4px 0 10px' }} />
                <div className="calc-row">
                  <span className="calc-label">Einsatz</span>
                  <span className="calc-value">{amount} ₫</span>
                </div>
                <div className="calc-row">
                  <span className="calc-label">Möglicher Gewinn</span>
                  <span className="calc-value positive">+{potentialWin} ₫</span>
                </div>
                <div className="calc-row">
                  <span className="calc-label">Quote</span>
                  <span className="calc-value">{quote}x</span>
                </div>

                {betError && <div className="alert alert-error" style={{ marginTop: 8 }}>{betError}</div>}

                <button
                  className={`submit-btn ${direction === 'yes' ? 'yes' : 'no'}`}
                  onClick={handleBet}
                  disabled={betLoading || betSuccess}
                >
                  {betSuccess ? '✓ Platziert' : betLoading ? 'Wird platziert…' : `${direction === 'yes' ? 'Ja' : 'Nein'} kaufen · ${amount} ₫`}
                </button>

                {!userId && (
                  <div className="alert alert-info" style={{ marginTop: 10, textAlign: 'center' }}>
                    Melde dich an, um zu handeln.
                  </div>
                )}
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Markt aufgelöst</div>
                <div style={{ fontSize: 24, fontWeight: 500, color: market.resolution === 'yes' ? 'var(--yes)' : 'var(--no)' }}>
                  {market.resolution === 'yes' ? 'Ja' : 'Nein'}
                </div>
              </div>
            )}

            {trades.length > 0 && (
              <div className="card">
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Letzte Aktivität</div>
                {trades.slice(-5).reverse().map((t) => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
                    <span style={{ color: t.direction === 'yes' ? 'var(--yes)' : 'var(--no)', fontWeight: 500 }}>
                      {t.direction === 'yes' ? 'Ja' : 'Nein'}
                    </span>
                    <span style={{ color: 'var(--text)' }}>{t.amount} ₫</span>
                    <span style={{ color: 'var(--text-subtle)' }}>{new Date(t.created_at).toLocaleDateString('de')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
