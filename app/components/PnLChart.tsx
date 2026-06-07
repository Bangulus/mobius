'use client'

import { useEffect, useRef, useState } from 'react'

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
  if (filter === '1T')  return new Date(now.getTime() - 1  * 24 * 60 * 60 * 1000)
  if (filter === '1W')  return new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000)
  if (filter === '1M')  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
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

export default function PnLChart({ userId, displayName, avatarUrl }: Props) {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const [trades, setTrades]       = useState<PayoutTrade[]>([])
  const [filter, setFilter]       = useState<TimeFilter>('ALLE')
  const [loading, setLoading]     = useState(true)
  const [sharing, setSharing]     = useState(false)

  // Trades laden
  useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/trades?user_id=eq.${userId}&type=eq.payout&select=cost,created_at&order=created_at.asc`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, cache: 'no-store' }
      )
      const data = await res.json()
      setTrades(data ?? [])
      setLoading(false)
    }
    load()
  }, [userId])

  // Gefilterte Datenpunkte berechnen
  const cutoff = filterCutoff(filter)
  const filtered = cutoff
    ? trades.filter(t => new Date(t.created_at) >= cutoff)
    : trades

  // Kumulativer PnL — Startpunkt ist 0, dann jeder Payout addiert
  // Aber: wir müssen auch Buy-Costs einrechnen. Da wir nur Payouts haben,
  // zeigen wir kumulativen Gewinn (Payouts) als positive Kurve.
  // Punkte: [{x: timestamp, y: kumulativ}]
  const points: { x: number; y: number }[] = []
  let cum = 0
  for (const t of filtered) {
    cum += t.cost
    points.push({ x: new Date(t.created_at).getTime(), y: cum })
  }

  // Aktueller PnL-Wert
  const currentPnL = points.length > 0 ? points[points.length - 1].y : 0
  const isPositive = currentPnL >= 0

  // Canvas zeichnen
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const PAD = { top: 16, right: 16, bottom: 24, left: 48 }
    const chartW = W - PAD.left - PAD.right
    const chartH = H - PAD.top - PAD.bottom

    ctx.clearRect(0, 0, W, H)

    // Hintergrund
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff'
    ctx.fillRect(0, 0, W, H)

    if (points.length === 0) {
      ctx.fillStyle = '#9ca3af'
      ctx.font = '13px Inter, system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('Noch keine Daten für diesen Zeitraum', W / 2, H / 2)
      return
    }

    const minX = points[0].x
    const maxX = points[points.length - 1].x
    const maxY = Math.max(...points.map(p => p.y), 0)
    const minY = Math.min(...points.map(p => p.y), 0)
    const rangeY = maxY - minY || 1
    const rangeX = maxX - minX || 1

    const toX = (x: number) => PAD.left + ((x - minX) / rangeX) * chartW
    const toY = (y: number) => PAD.top + chartH - ((y - minY) / rangeY) * chartH

    const color = isPositive ? '#12b76a' : '#f04438'

    // Grid-Linien
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (chartH / 4) * i
      ctx.beginPath()
      ctx.moveTo(PAD.left, y)
      ctx.lineTo(PAD.left + chartW, y)
      ctx.stroke()
    }

    // Nulllinie wenn negativ
    if (minY < 0) {
      const zeroY = toY(0)
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(PAD.left, zeroY)
      ctx.lineTo(PAD.left + chartW, zeroY)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Gradient fill
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH)
    grad.addColorStop(0, isPositive ? 'rgba(18,183,106,0.25)' : 'rgba(240,68,56,0.25)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')

    ctx.beginPath()
    ctx.moveTo(toX(points[0].x), toY(0))
    points.forEach(p => ctx.lineTo(toX(p.x), toY(p.y)))
    ctx.lineTo(toX(points[points.length - 1].x), toY(0))
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

    // Y-Achse Labels
    ctx.fillStyle = '#9ca3af'
    ctx.font = '10px Inter, system-ui'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 4; i++) {
      const val = minY + (rangeY / 4) * (4 - i)
      const y = PAD.top + (chartH / 4) * i
      ctx.fillText(`${Math.round(val)}`, PAD.left - 4, y + 4)
    }

    // Endpunkt-Dot
    const lastP = points[points.length - 1]
    ctx.beginPath()
    ctx.arc(toX(lastP.x), toY(lastP.y), 4, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.stroke()

  }, [points, isPositive, filter])

  // Share PNG generieren
  async function handleShare() {
    setSharing(true)
    try {
      const W = 600
      const H = 340
      const PAD = { top: 80, right: 32, bottom: 60, left: 64 }
      const chartW = W - PAD.left - PAD.right
      const chartH = H - PAD.top - PAD.bottom

      const offscreen = document.createElement('canvas')
      offscreen.width  = W * 2
      offscreen.height = H * 2
      const ctx = offscreen.getContext('2d')!
      ctx.scale(2, 2)

      // Hintergrund dunkel
      ctx.fillStyle = '#0f1117'
      ctx.fillRect(0, 0, W, H)

      // Möbius Logo Text (da wir kein externes Bild laden können zuverlässig)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 18px Georgia, serif'
      ctx.textAlign = 'left'
      ctx.fillText('Möbius', 28, 34)

      // Username
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '12px Inter, system-ui'
      ctx.fillText(`@${displayName}`, 28, 52)

      // PnL Wert
      const color = isPositive ? '#12b76a' : '#f04438'
      ctx.fillStyle = color
      ctx.font = 'bold 28px Inter, system-ui'
      ctx.textAlign = 'right'
      ctx.fillText(formatPnL(currentPnL), W - 28, 38)

      // Filter Label
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      ctx.font = '11px Inter, system-ui'
      ctx.fillText(filterLabel(filter), W - 28, 56)

      if (points.length > 1) {
        const minX = points[0].x
        const maxX = points[points.length - 1].x
        const maxY = Math.max(...points.map(p => p.y), 0)
        const minY = Math.min(...points.map(p => p.y), 0)
        const rangeY = maxY - minY || 1
        const rangeX = maxX - minX || 1

        const toX = (x: number) => PAD.left + ((x - minX) / rangeX) * chartW
        const toY = (y: number) => PAD.top + chartH - ((y - minY) / rangeY) * chartH

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'
        ctx.lineWidth = 1
        for (let i = 0; i <= 3; i++) {
          const y = PAD.top + (chartH / 3) * i
          ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + chartW, y); ctx.stroke()
        }

        // Gradient fill
        const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH)
        grad.addColorStop(0, isPositive ? 'rgba(18,183,106,0.3)' : 'rgba(240,68,56,0.3)')
        grad.addColorStop(1, 'rgba(15,17,23,0)')
        ctx.beginPath()
        ctx.moveTo(toX(points[0].x), toY(0))
        points.forEach(p => ctx.lineTo(toX(p.x), toY(p.y)))
        ctx.lineTo(toX(points[points.length - 1].x), toY(0))
        ctx.closePath()
        ctx.fillStyle = grad
        ctx.fill()

        // Linie
        ctx.beginPath()
        ctx.strokeStyle = color
        ctx.lineWidth = 2.5
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(toX(p.x), toY(p.y))
          else ctx.lineTo(toX(p.x), toY(p.y))
        })
        ctx.stroke()

        // Endpunkt
        const last = points[points.length - 1]
        ctx.beginPath()
        ctx.arc(toX(last.x), toY(last.y), 5, 0, Math.PI * 2)
        ctx.fillStyle = color; ctx.fill()
        ctx.strokeStyle = '#0f1117'; ctx.lineWidth = 2; ctx.stroke()

        // Y-Labels
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.font = '10px Inter, system-ui'
        ctx.textAlign = 'right'
        for (let i = 0; i <= 3; i++) {
          const val = minY + (rangeY / 3) * (3 - i)
          const y = PAD.top + (chartH / 3) * i
          ctx.fillText(`${Math.round(val)} ₫`, PAD.left - 6, y + 4)
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        ctx.font = '13px Inter, system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('Noch keine Daten', W / 2, PAD.top + chartH / 2)
      }

      // Footer
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.font = '10px Inter, system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('moebiusmarkets.de', W / 2, H - 16)

      // Download
      const url  = offscreen.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `mobius-pnl-${displayName}.png`
      link.href = url
      link.click()
    } finally {
      setSharing(false)
    }
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
          disabled={sharing || points.length === 0}
          title="Als Bild teilen"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: '0.5px solid var(--border)',
            borderRadius: 8, padding: '4px 10px', cursor: points.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font)',
            opacity: points.length === 0 ? 0.4 : 1, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (points.length > 0) e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          {sharing ? 'Wird erstellt…' : 'Teilen'}
        </button>
      </div>

      {/* PnL Wert */}
      <div style={{ fontSize: 28, fontWeight: 800, color: isPositive ? 'var(--yes)' : 'var(--no)', letterSpacing: '-1px', lineHeight: 1, marginBottom: 2 }}>
        {loading ? '—' : formatPnL(currentPnL)}
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
        <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
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
