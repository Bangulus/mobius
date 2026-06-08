'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface PayoutTrade {
  cost: number
  created_at: string
}

interface Props {
  userId: string
  displayName: string
  avatarUrl?: string
}

type TimeFilter = '1T' | '1W' | '1M' | '1J' | 'ALLE'

const FILTERS: TimeFilter[] = ['1T', '1W', '1M', '1J', 'ALLE']

function filterCutoff(filter: TimeFilter): Date | null {
  const now = new Date()
  if (filter === '1T')  return new Date(now.getTime() - 1   * 24 * 60 * 60 * 1000)
  if (filter === '1W')  return new Date(now.getTime() - 7   * 24 * 60 * 60 * 1000)
  if (filter === '1M')  return new Date(now.getTime() - 30  * 24 * 60 * 60 * 1000)
  if (filter === '1J')  return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
  return null
}

function formatPnL(val: number): string {
  const abs = Math.abs(Math.round(val))
  return `${val >= 0 ? '+' : '-'}${abs.toLocaleString('de')} ₫`
}

function filterLabel(filter: TimeFilter): string {
  if (filter === '1T') return 'Letzter Tag'
  if (filter === '1W') return 'Letzte Woche'
  if (filter === '1M') return 'Letzter Monat'
  if (filter === '1J') return 'Letztes Jahr'
  return 'Gesamt'
}

export default function PnLChart({ userId, displayName }: Props) {
  const canvasRef                   = useRef<HTMLCanvasElement>(null)
  const [trades, setTrades]         = useState<PayoutTrade[]>([])
  const [filter, setFilter]         = useState<TimeFilter>('ALLE')
  const [loading, setLoading]       = useState(true)
  const [copied, setCopied]         = useState(false)

  // ── Trades laden + Auto-Refresh alle 3s ──────────────────
  const loadTrades = useCallback(async () => {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/trades?user_id=eq.${userId}&type=eq.payout&select=cost,created_at&order=created_at.asc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, cache: 'no-store' }
    )
    const data = await res.json()
    setTrades(data ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    loadTrades()
    const id = setInterval(loadTrades, 3000)
    return () => clearInterval(id)
  }, [loadTrades])

  // ── Datenpunkte berechnen ────────────────────────────────
  const cutoff  = filterCutoff(filter)
  const now     = Date.now()

  // Gesamte kumulative Basis vor dem Filterfenster
  const baseCum = cutoff
    ? trades.filter(t => new Date(t.created_at).getTime() < cutoff.getTime()).reduce((s, t) => s + t.cost, 0)
    : 0

  const filtered = cutoff
    ? trades.filter(t => new Date(t.created_at) >= cutoff)
    : trades

  // Punkte bauen — immer Startpunkt + Endpunkt damit nie nur ein Punkt
  const rawPoints: { x: number; y: number }[] = []
  let cum = baseCum
  for (const t of filtered) {
    rawPoints.push({ x: new Date(t.created_at).getTime(), y: cum })
    cum += t.cost
    rawPoints.push({ x: new Date(t.created_at).getTime(), y: cum })
  }

  // Immer Startpunkt (linker Rand des Zeitfensters) und Endpunkt (jetzt)
  const windowStart = cutoff ? cutoff.getTime() : (trades.length > 0 ? new Date(trades[0].created_at).getTime() : now - 86400000)
  const startY      = baseCum
  const endY        = cum

  const points: { x: number; y: number }[] = [
    { x: windowStart, y: startY },
    ...rawPoints,
    { x: now, y: endY },
  ]

  const currentPnL = endY - baseCum  // PnL innerhalb des Fensters
  const totalPnL   = endY             // Gesamter kumulativer Gewinn
  const displayPnL = filter === 'ALLE' ? totalPnL : currentPnL
  const isPositive = displayPnL >= 0

  // ── Canvas zeichnen ──────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || loading) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const PAD = { top: 16, right: 16, bottom: 24, left: 52 }
    const chartW = W - PAD.left - PAD.right
    const chartH = H - PAD.top - PAD.bottom

    ctx.clearRect(0, 0, W, H)

    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff'
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, W, H)

    const minX = points[0].x
    const maxX = points[points.length - 1].x
    const allY  = points.map(p => p.y)
    const maxY  = Math.max(...allY, startY + 1)
    const minY  = Math.min(...allY, startY - 1)
    const rangeY = maxY - minY || 1
    const rangeX = maxX - minX || 1

    const toX = (x: number) => PAD.left + ((x - minX) / rangeX) * chartW
    const toY = (y: number) => PAD.top + chartH - ((y - minY) / rangeY) * chartH

    const color = isPositive ? '#12b76a' : '#f04438'

    // Grid
    ctx.strokeStyle = 'rgba(0,0,0,0.05)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (chartH / 4) * i
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + chartW, y); ctx.stroke()
    }

    // Nulllinie
    const zeroY = toY(startY)
    if (zeroY > PAD.top && zeroY < PAD.top + chartH) {
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'
      ctx.setLineDash([4, 4])
      ctx.beginPath(); ctx.moveTo(PAD.left, zeroY); ctx.lineTo(PAD.left + chartW, zeroY); ctx.stroke()
      ctx.setLineDash([])
    }

    // Gradient fill
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH)
    grad.addColorStop(0, isPositive ? 'rgba(18,183,106,0.2)' : 'rgba(240,68,56,0.2)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.beginPath()
    ctx.moveTo(toX(points[0].x), toY(startY))
    points.forEach(p => ctx.lineTo(toX(p.x), toY(p.y)))
    ctx.lineTo(toX(points[points.length - 1].x), toY(startY))
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    // Linie
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(toX(p.x), toY(p.y))
      else ctx.lineTo(toX(p.x), toY(p.y))
    })
    ctx.stroke()

    // Y-Labels
    ctx.fillStyle = '#9ca3af'
    ctx.font = '10px Inter, system-ui'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 4; i++) {
      const val = minY + (rangeY / 4) * (4 - i)
      const y   = PAD.top + (chartH / 4) * i
      ctx.fillText(`${Math.round(val)}`, PAD.left - 4, y + 4)
    }

    // Endpunkt-Dot
    const lastP = points[points.length - 1]
    ctx.beginPath()
    ctx.arc(toX(lastP.x), toY(lastP.y), 4, 0, Math.PI * 2)
    ctx.fillStyle = color; ctx.fill()
    ctx.strokeStyle = bgColor; ctx.lineWidth = 1.5; ctx.stroke()

  }, [points, isPositive, loading, startY, filter])

  // ── Share: URL kopieren ──────────────────────────────────
  function handleShare() {
    const url = `${window.location.origin}/profil/${encodeURIComponent(displayName)}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: isPositive ? 'var(--yes)' : 'var(--no)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gewinn / Verlust</span>
        </div>
        <button
          onClick={handleShare}
          title="Profil-Link kopieren"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: copied ? 'var(--yes-light)' : 'none',
            border: `0.5px solid ${copied ? 'var(--yes-border)' : 'var(--border)'}`,
            borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
            fontSize: 12, color: copied ? 'var(--yes)' : 'var(--text-muted)',
            fontFamily: 'var(--font)', transition: 'all 0.15s',
          }}
        >
          {copied ? (
            <>✓ Kopiert</>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              Teilen
            </>
          )}
        </button>
      </div>

      {/* PnL Wert */}
      <div style={{ fontSize: 28, fontWeight: 800, color: isPositive ? 'var(--yes)' : 'var(--no)', letterSpacing: '-1px', lineHeight: 1, marginBottom: 2 }}>
        {loading ? '—' : formatPnL(displayPnL)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>{filterLabel(filter)}</div>

      {/* Zeitfilter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: filter === f ? '1px solid var(--accent)' : '1px solid transparent',
              background: filter === f ? 'var(--accent-light)' : 'none',
              color: filter === f ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'var(--font)', transition: 'all 0.15s',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Canvas */}
      {loading ? (
        <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          Wird geladen…
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          width={320}
          height={110}
          style={{ width: '100%', height: 110, borderRadius: 8 }}
        />
      )}
    </div>
  )
}
