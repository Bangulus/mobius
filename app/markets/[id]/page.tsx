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
  group_title?: string
  short_label?: string
  category?: string
  resolved: boolean
  resolution?: string
  is_auto?: boolean
  coin?: string
}

interface Trade {
  id: string
  market_id: string
  user_id: string
  direction: 'yes' | 'no'
  amount: number
  created_at: string
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

const CAT_CLASS: Record<string, string> = {
  Politik:       'cat-politik',
  Sport:         'cat-sport',
  Krypto:        'cat-krypto',
  Entertainment: 'cat-entertainment',
  Wirtschaft:    'cat-wirtschaft',
}

type Tab = '7T' | '1M' | 'Gesamt'

export default function MarketPage() {
  const params   = useParams()
  const router   = useRouter()
  const marketId = params?.id as string

  const [market, setMarket]       = useState<Market | null>(null)
  const [trades, setTrades]       = useState<Trade[]>([])
  const [user, setUser]           = useState<User | null>(null)
  const [loading, setLoading]     = useState(true)
  const [direction, setDirection] = useState<'yes' | 'no'>('yes')
  const [amount, setAmount]       = useState(100)
  const [betLoading, setBetLoading] = useState(false)
  const [betError, setBetError]   = useState('')
  const [betSuccess, setBetSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('7T')
  const [darkMode, setDarkMode]   = useState(false)

  const chartRef      = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<unknown>(null)

  /* Session laden */
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

  /* Dark Mode */
  useEffect(() => {
    const theme = document.documentElement.getAttribute('data-theme')
    setDarkMode(theme === 'dark')
  }, [])

  /* Markt laden */
  const loadMarket = useCallback(async () => {
    const data = await dbGet('markets', `id=eq.${marketId}&select=*`)
    if (data?.[0]) setMarket(data[0])
    setLoading(false)
  }, [marketId])

  /* Trades laden */
  const loadTrades = useCallback(async () => {
    const data = await dbGet('trades', `market_id=eq.${marketId}&select=*&order=created_at.asc`)
    setTrades(data ?? [])
  }, [marketId])

  useEffect(() => {
    loadMarket()
    loadTrades()
  }, [loadMarket, loadTrades])

  /* Preisverlauf berechnen */
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
    if (!chartRef.current) return
    if (priceHistory.length === 0) return

    const build = async () => {
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)

      const now   = new Date()
      const since = activeTab === '7T'
        ? new Date(now.getTime() - 7  * 24 * 3600 * 1000)
        : activeTab === '1M'
        ? new Date(now.getTime() - 30 * 24 * 3600 * 1000)
        : new Date(0)

      const filtered = priceHistory.filter((p) => new Date(p.t) >= since)
      const pts      = filtered.length > 0 ? filtered : priceHistory.slice(-10)

      const isDark    = document.documentElement.getAttribute('data-theme') === 'dark'
      const gridColor = isDark ? '#2a2d3a' : '#e8eaef'
      const tickColor = isDark ? '#94a3b8' : '#9ca3af'

      if (chartInstance.current) {
        (chartInstance.current as { destroy: () => void }).destroy()
      }

      chartInstance.current = new Chart(chartRef.current!, {
        type: 'line',
        data: {
          labels: pts.map((p) => {
            const d = new Date(p.t)
            return activeTab === 'Gesamt'
              ? d.toLocaleDateString('de', { month: 'short', day: 'numeric' })
              : d.toLocaleDateString('de', { day: '2-digit', month: '2-digit' })
          }),
          datasets: [{
            data: pts.map((p) => p.prob),
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
            x: {
              grid: { color: gridColor },
              ticks: { color: tickColor, font: { size: 11 }, maxTicksLimit: 6 },
            },
            y: {
              min: 0, max: 100,
              grid: { color: gridColor },
              ticks: { color: tickColor, font: { size: 11 }, callback: (v) => `${v}%` },
            },
          },
        },
      })
    }

    build()
    return () => {
      if (chartInstance.current) {
        (chartInstance.current as { destroy: () => void }).destroy()
      }
    }
  }, [priceHistory, activeTab])

  /* Wette platzieren */
  async function placeBet() {
    if (!user || !market) return
    if (amount <= 0) { setBetError('Ungültiger Betrag.'); return }
    if (user.balance < amount) { setBetError('Nicht genug Guthaben.'); return }

    setBetLoading(true)
    setBetError('')

    const session = JSON.parse(localStorage.getItem('mobius_session') ?? '{}')
    const token   = session?.access_token ?? SUPABASE_KEY

    const newQYes = direction === 'yes' ? market.q_yes + amount : market.q_yes
    const newQNo  = direction === 'no'  ? market.q_no  + amount : market.q_no

    const tradeRes = await fetch(`${SUPABASE_URL}/rest/v1/trades`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ market_id: marketId, user_id: user.id, direction, amount }),
    })

    if (!tradeRes.ok) { setBetError('Fehler beim Platzieren.'); setBetLoading(false); return }

    await fetch(`${SUPABASE_URL}/rest/v1/markets?id=eq.${marketId}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ q_yes: newQYes, q_no: newQNo }),
    })

    await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ balance: user.balance - amount }),
    })

    setUser({ ...user, balance: user.balance - amount })
    setBetSuccess(true)
    setBetLoading(false)
    loadMarket()
    loadTrades()
    setTimeout(() => setBetSuccess(false), 2500)
  }

  /* ── Render ── */
  if (loading) return (
    <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>Markt wird geladen…</div>
  )

  if (!market) return (
    <div style={{ padding: 32 }}>
      <div style={{ color: 'var(--no)', fontSize: 14, marginBottom: 16 }}>Markt nicht gefunden.</div>
      <button className="nav-pill" onClick={() => router.push('/')}>← Zurück</button>
    </div>
  )

  const prob     = calcProb(market.q_yes, market.q_no, market.b)
  const isLow    = prob < 50
  const catClass = CAT_CLASS[market.category ?? ''] ?? ''

  const cost   = amount
  const probAfterYes = calcProb(market.q_yes + amount, market.q_no, market.b)
  const probAfterNo  = calcProb(market.q_yes, market.q_no + amount, market.b)
  const probAfter    = direction === 'yes' ? probAfterYes : probAfterNo

  return (
    <>
      {/* ── Nav (mini) ── */}
      <nav className="nav">
        <div className="nav-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-weiss.png"
            alt="Möbius"
            className="nav-logo"
            onClick={() => router.push('/')}
            style={{ cursor: 'pointer' }}
          />
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

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {market.category && (
              <span className={`cat-badge ${catClass}`}>{market.category}</span>
            )}
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
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 8 }}>
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

        {/* ── Layout: Chart + Trading ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

          {/* ── Chart ── */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Preisverlauf</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['7T', '1M', 'Gesamt'] as Tab[]).map((t) => (
                  <button key={t}
                    onClick={() => setActiveTab(t)}
                    style={{
                      fontSize: 12, padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: activeTab === t ? 'var(--accent)' : 'var(--surface)',
                      color: activeTab === t ? '#fff' : 'var(--text-muted)',
                      fontWeight: activeTab === t ? 600 : 400,
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {priceHistory.length === 0 ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>
                Noch keine Trades — Chart erscheint nach der ersten Wette.
              </div>
            ) : (
              <div style={{ height: 200, position: 'relative' }}>
                <canvas ref={chartRef} />
              </div>
            )}
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-subtle)' }}>
              Volumen: {Math.round(market.q_yes + market.q_no).toLocaleString('de')} ₫ · {trades.length} Trades
            </div>
          </div>

          {/* ── Trading Panel ── */}
          <div className="card" style={{ position: 'sticky', top: 'calc(var(--nav-height) + 16px)' }}>
            {market.resolved ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Markt aufgelöst</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Ergebnis: <strong style={{ color: market.resolution === 'yes' ? 'var(--yes)' : 'var(--no)' }}>
                    {market.resolution === 'yes' ? 'Ja' : 'Nein'}
                  </strong>
                </div>
              </div>
            ) : !user ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>Anmelden um zu wetten</div>
                <button className="submit-btn yes" onClick={() => router.push('/')}>Zur Anmeldung</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Handeln</div>

                {/* Ja / Nein Toggle */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  <button
                    onClick={() => setDirection('yes')}
                    style={{
                      padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
                      background: direction === 'yes' ? 'rgba(22,163,74,0.15)' : 'var(--surface)',
                      color: direction === 'yes' ? 'var(--yes)' : 'var(--text-muted)',
                      outline: direction === 'yes' ? '2px solid var(--yes)' : '2px solid transparent',
                    }}>
                    Ja · {prob}%
                  </button>
                  <button
                    onClick={() => setDirection('no')}
                    style={{
                      padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
                      background: direction === 'no' ? 'rgba(220,38,38,0.15)' : 'var(--surface)',
                      color: direction === 'no' ? 'var(--no)' : 'var(--text-muted)',
                      outline: direction === 'no' ? '2px solid var(--no)' : '2px solid transparent',
                    }}>
                    Nein · {100 - prob}%
                  </button>
                </div>

                {/* Einsatz */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Einsatz (₫)</div>
                  <input
                    type="number"
                    min={1}
                    max={user.balance}
                    value={amount}
                    onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
                    style={{ width: '100%', fontSize: 16, fontWeight: 600 }}
                  />
                  {/* Schnellbeträge */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    {[50, 100, 200, 500].map((v) => (
                      <button key={v} onClick={() => setAmount(v)}
                        style={{
                          flex: 1, fontSize: 12, padding: '4px 0', borderRadius: 6,
                          border: '1px solid var(--border)', background: amount === v ? 'var(--accent)' : 'var(--surface)',
                          color: amount === v ? '#fff' : 'var(--text-muted)', cursor: 'pointer',
                        }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Kalkulation */}
                <div style={{
                  background: 'var(--surface)', borderRadius: 8, padding: '10px 12px',
                  fontSize: 12, color: 'var(--text-muted)', marginBottom: 14,
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Einsatz</span><span style={{ color: 'var(--text)' }}>{cost} ₫</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Kurs danach</span>
                    <span style={{ color: 'var(--text)' }}>
                      {direction === 'yes' ? probAfter : 100 - probAfter}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Guthaben danach</span>
                    <span style={{ color: 'var(--text)' }}>{(user.balance - cost).toLocaleString('de')} ₫</span>
                  </div>
                </div>

                {betError && <div className="alert alert-error" style={{ marginBottom: 10 }}>{betError}</div>}
                {betSuccess && <div className="alert alert-success" style={{ marginBottom: 10 }}>Wette platziert ✓</div>}

                <button
                  className={`submit-btn ${direction === 'yes' ? 'yes' : 'no'}`}
                  onClick={placeBet}
                  disabled={betLoading || amount <= 0 || amount > user.balance}
                  style={{ width: '100%' }}>
                  {betLoading ? 'Wird platziert…' : `${direction === 'yes' ? 'Ja' : 'Nein'} — ${amount} ₫ setzen`}
                </button>

                <div style={{ fontSize: 11, color: 'var(--text-subtle)', textAlign: 'center', marginTop: 8 }}>
                  Guthaben: {user.balance.toLocaleString('de')} ₫
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Letzte Trades ── */}
        {trades.length > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Letzte Trades</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...trades].reverse().slice(0, 10).map((t) => (
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
