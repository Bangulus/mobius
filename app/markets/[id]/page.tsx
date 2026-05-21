'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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
  match_id?: string
  outcome?: string
  display_group?: string
  short_label?: string
  group_title?: string
  team_icon_url?: string
}

interface Trade {
  id: string
  market_id: string
  user_id: string
  type: string
  shares: number
  cost: number
  price_before: number
  price_after: number
  created_at: string
}

interface Position {
  id: string
  user_id: string
  market_id: string
  shares_yes: number
  shares_no: number
  updated_at: string
}

interface User {
  id: string
  username: string
  balance: number
  avatar_url?: string
}

interface PricePoint {
  t: number
  price: number
}

interface ResultToast {
  won: boolean
  amount: number
  resolution: string
  coin?: string
  nextMarketId?: string
}

function calcProb(qYes: number, qNo: number, b: number): number {
  const eYes = Math.exp(qYes / b)
  const eNo  = Math.exp(qNo  / b)
  return Math.round((eYes / (eYes + eNo)) * 100)
}

function lmsrCost(qYes: number, qNo: number, b: number, side: 'yes' | 'no', shares: number): number {
  const newQYes = side === 'yes' ? qYes + shares : qYes
  const newQNo  = side === 'no'  ? qNo  + shares : qNo
  const before  = b * Math.log(Math.exp(qYes / b) + Math.exp(qNo / b))
  const after   = b * Math.log(Math.exp(newQYes / b) + Math.exp(newQNo / b))
  return Math.max(0, after - before)
}

function lmsrSharesForSpend(qYes: number, qNo: number, b: number, side: 'yes' | 'no', spend: number): number {
  let lo = 0, hi = spend * 10
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2
    if (lmsrCost(qYes, qNo, b, side, mid) < spend) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}

function lmsrSellReturn(qYes: number, qNo: number, b: number, side: 'yes' | 'no', shares: number): number {
  const newQYes = side === 'yes' ? Math.max(0, qYes - shares) : qYes
  const newQNo  = side === 'no'  ? Math.max(0, qNo  - shares) : qNo
  const before  = b * Math.log(Math.exp(qYes / b) + Math.exp(qNo / b))
  const after   = b * Math.log(Math.exp(newQYes / b) + Math.exp(newQNo / b))
  return Math.max(0, before - after)
}

function parseUTC(raw: string): Date {
  if (!raw) return new Date(0)
  if (raw.endsWith('Z') || raw.match(/[+-]\d{2}:\d{2}$/)) return new Date(raw)
  if (raw.match(/[+-]\d{2}$/)) return new Date(raw + ':00')
  return new Date(raw.replace(' ', 'T') + 'Z')
}

async function fetchCoinbasePrice(coin: string): Promise<number | null> {
  try {
    const res  = await fetch(`https://api.coinbase.com/v2/prices/${coin.toUpperCase()}-USD/spot`, { cache: 'no-store' })
    const data = await res.json()
    return parseFloat(data.data.amount)
  } catch { return null }
}

async function fetchFinancePrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/finance-price?symbol=${encodeURIComponent(symbol)}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return data.price ?? null
  } catch { return null }
}

function drawCryptoChart(
  canvas: HTMLCanvasElement,
  history: PricePoint[],
  targetPrice: number,
  marketStartMs: number,
  marketEndMs: number,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width, H = canvas.height
  const padL = 72, padR = 96, padT = 20, padB = 28
  const visiblePrices = history.length > 0 ? history.map(p => p.price) : [targetPrice]
  const midPrice = visiblePrices[visiblePrices.length - 1] ?? targetPrice
  const spread   = midPrice * 0.0025
  const allVals  = [...visiblePrices, targetPrice]
  const minP     = Math.min(Math.min(...allVals), midPrice - spread)
  const maxP     = Math.max(Math.max(...allVals), midPrice + spread)
  const duration = marketEndMs - marketStartMs
  const xScale   = (ms: number) => padL + ((Math.min(ms, marketEndMs) - marketStartMs) / duration) * (W - padL - padR)
  const yScale   = (p: number)  => padT + ((maxP - p) / (maxP - minP)) * (H - padT - padB)

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = '#e8eaef'; ctx.lineWidth = 1; ctx.setLineDash([])
  for (let i = 0; i <= 5; i++) {
    const y = yScale(minP + (maxP - minP) * (i / 5))
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke()
  }

  const targetY = yScale(targetPrice)
  ctx.beginPath(); ctx.setLineDash([5, 4]); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5
  ctx.moveTo(padL, targetY); ctx.lineTo(W - padR, targetY); ctx.stroke(); ctx.setLineDash([])
  ctx.fillStyle = '#fffbeb'; ctx.beginPath(); ctx.rect(W - padR + 4, targetY - 11, 88, 22); ctx.fill()
  ctx.fillStyle = '#92400e'; ctx.font = 'bold 10px Inter, sans-serif'; ctx.textAlign = 'left'
  ctx.fillText('Target', W - padR + 8, targetY - 1)
  ctx.fillStyle = '#b45309'; ctx.font = '9px Inter, sans-serif'
  ctx.fillText(`$${targetPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, W - padR + 8, targetY + 10)

  const filteredHistory = history.filter(p => p.t <= marketEndMs)
  if (filteredHistory.length > 0) {
    ctx.beginPath()
    filteredHistory.forEach((p, i) => { i === 0 ? ctx.moveTo(xScale(p.t), yScale(p.price)) : ctx.lineTo(xScale(p.t), yScale(p.price)) })
    const lastX = xScale(filteredHistory[filteredHistory.length - 1].t)
    ctx.lineTo(lastX, H - padB); ctx.lineTo(xScale(filteredHistory[0].t), H - padB); ctx.closePath()
    const grad = ctx.createLinearGradient(0, padT, 0, H - padB)
    grad.addColorStop(0, 'rgba(251,146,60,0.22)'); grad.addColorStop(1, 'rgba(251,146,60,0.0)')
    ctx.fillStyle = grad; ctx.fill()
    ctx.beginPath()
    filteredHistory.forEach((p, i) => { i === 0 ? ctx.moveTo(xScale(p.t), yScale(p.price)) : ctx.lineTo(xScale(p.t), yScale(p.price)) })
    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke()
    const last = filteredHistory[filteredHistory.length - 1]
    ctx.beginPath(); ctx.arc(xScale(last.t), yScale(last.price), 4.5, 0, Math.PI * 2)
    ctx.fillStyle = '#f97316'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()
  }

  ctx.fillStyle = '#94a3b8'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'right'
  for (let i = 0; i <= 5; i++) {
    const val = minP + (maxP - minP) * (1 - i / 5)
    ctx.fillText(`$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, padL - 6, yScale(val) + 4)
  }
  ctx.textAlign = 'center'
  for (let i = 0; i <= 3; i++) {
    const ms = marketStartMs + (duration * i / 3)
    const d  = new Date(ms)
    ctx.fillText(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`, xScale(ms), H - padB + 16)
  }
}

const CAT_CLASS: Record<string, string> = {
  Politik: 'cat-politik', Sport: 'cat-sport', Krypto: 'cat-krypto',
  Entertainment: 'cat-entertainment', Wirtschaft: 'cat-wirtschaft',
  weather: 'cat-sport', Wetter: 'cat-sport',
}
const COIN_COLORS: Record<string, string> = { BTC: '#f59e0b', ETH: '#6366f1', SOL: '#9945ff', XRP: '#00aae4' }

function normalizeTeamName(name: string): string {
  return name.toLowerCase()
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ä/g, 'a').replace(/ß/g, 'ss')
    .replace(/\./g, '').replace(/\s+/g, ' ').trim()
}

const TEAM_LOGOS_RAW: Record<string, string> = {
  'fc bayern munchen':        'https://tmssl.akamaized.net/images/wappen/head/27.png',
  'borussia dortmund':        'https://tmssl.akamaized.net/images/wappen/head/16.png',
  'bv borussia 09 dortmund':  'https://tmssl.akamaized.net/images/wappen/head/16.png',
  'rb leipzig':               'https://tmssl.akamaized.net/images/wappen/head/23826.png',
  'bayer 04 leverkusen':      'https://tmssl.akamaized.net/images/wappen/head/15.png',
  'eintracht frankfurt':      'https://tmssl.akamaized.net/images/wappen/head/24.png',
  'vfb stuttgart':            'https://tmssl.akamaized.net/images/wappen/head/79.png',
  'tsg hoffenheim':           'https://tmssl.akamaized.net/images/wappen/head/533.png',
  'tsg 1899 hoffenheim':      'https://tmssl.akamaized.net/images/wappen/head/533.png',
  'sc freiburg':              'https://tmssl.akamaized.net/images/wappen/head/60.png',
  'borussia monchengladbach': 'https://tmssl.akamaized.net/images/wappen/head/18.png',
  'vfl wolfsburg':            'https://tmssl.akamaized.net/images/wappen/head/82.png',
  'fc augsburg':              'https://tmssl.akamaized.net/images/wappen/head/167.png',
  'sv werder bremen':         'https://tmssl.akamaized.net/images/wappen/head/86.png',
  'mainz 05':                 'https://tmssl.akamaized.net/images/wappen/head/39.png',
  '1 fsv mainz 05':           'https://tmssl.akamaized.net/images/wappen/head/39.png',
  'fsv mainz 05':             'https://tmssl.akamaized.net/images/wappen/head/39.png',
  'fc st pauli':              'https://tmssl.akamaized.net/images/wappen/head/35.png',
  '1 fc union berlin':        'https://tmssl.akamaized.net/images/wappen/head/89.png',
  'union berlin':             'https://tmssl.akamaized.net/images/wappen/head/89.png',
  '1 fc heidenheim 1846':     'https://tmssl.akamaized.net/images/wappen/head/2036.png',
  'fc heidenheim 1846':       'https://tmssl.akamaized.net/images/wappen/head/2036.png',
  'hamburger sv':             'https://tmssl.akamaized.net/images/wappen/head/41.png',
  '1 fc koln':                'https://tmssl.akamaized.net/images/wappen/head/3.png',
  'fc koln':                  'https://tmssl.akamaized.net/images/wappen/head/3.png',
  'vfl bochum':               'https://tmssl.akamaized.net/images/wappen/head/80.png',
  'holstein kiel':            'https://tmssl.akamaized.net/images/wappen/head/1896.png',
  'fortuna dusseldorf':       'https://tmssl.akamaized.net/images/wappen/head/44.png',
  'sv darmstadt 98':          'https://tmssl.akamaized.net/images/wappen/head/105.png',
}

function getTeamLogo(name: string): string | undefined {
  return TEAM_LOGOS_RAW[normalizeTeamName(name)]
}

const TEAM_COLORS: Record<string, string> = {
  'FC Bayern München': '#dc052d', 'Borussia Dortmund': '#1a1a1a',
  'BV Borussia 09 Dortmund': '#1a1a1a', 'Bayer 04 Leverkusen': '#e32221',
  'RB Leipzig': '#dd0741', 'Eintracht Frankfurt': '#e1000f',
  'VfB Stuttgart': '#e32219', 'SC Freiburg': '#e30613',
  'Union Berlin': '#eb1923', '1. FC Union Berlin': '#eb1923',
  'Borussia Mönchengladbach': '#000000', 'VfL Wolfsburg': '#65b32e',
  'TSG Hoffenheim': '#1961ae', 'FC Augsburg': '#ba3733',
  'SV Werder Bremen': '#1d9053', 'Mainz 05': '#c1121c',
  '1. FSV Mainz 05': '#c1121c', 'VfL Bochum': '#005aaa',
  'FC Heidenheim': '#e2001a', '1. FC Heidenheim 1846': '#e2001a',
  'SV Darmstadt 98': '#004f9f', 'Holstein Kiel': '#c8102e',
  'FC St. Pauli': '#6b3c26', 'Hamburger SV': '#0033a0', '1. FC Köln': '#c8102e',
}

function getTeamColor(name: string): string { return TEAM_COLORS[name] ?? '#6366f1' }

function getTeamInitials(name: string): string {
  const clean = name.replace(/^(FC|BV|SV|TSG|VfB|VfL|SC|RB|1\.|FSV)\s+/i, '')
  const words = clean.split(' ').filter(Boolean)
  if (words.length === 1) return words[0].substring(0, 3).toUpperCase()
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase()
}

function TeamIcon({ name, size = 64 }: { name: string; size?: number }) {
  const [imgError, setImgError] = useState(false)
  const logoUrl  = getTeamLogo(name)
  const color    = getTeamColor(name)
  const radius   = Math.round(size * 0.22)
  const fontSize = Math.round(size * 0.32)
  if (logoUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt={name} onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: radius, objectFit: 'contain', background: '#fff', padding: Math.round(size * 0.08), boxShadow: `0 2px 12px ${color}33`, flexShrink: 0 }} />
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize, fontWeight: 900, color: '#fff', boxShadow: `0 2px 12px ${color}44`, flexShrink: 0 }}>
      {getTeamInitials(name)}
    </div>
  )
}

function LivePositionsBar({ trades, isKrypto }: { trades: Trade[]; isKrypto: boolean }) {
  const buyTrades = trades.filter(t => t.type === 'buy_yes' || t.type === 'buy_no')
  if (buyTrades.length < 3) return null
  const yesCount    = buyTrades.filter(t => t.type === 'buy_yes').length
  const noCount     = buyTrades.filter(t => t.type === 'buy_no').length
  const total       = yesCount + noCount
  const yesPct      = Math.round((yesCount / total) * 100)
  const noPct       = 100 - yesPct
  const majority    = yesPct >= noPct ? 'yes' : 'no'
  const majorityPct = majority === 'yes' ? yesPct : noPct
  const majorityLabel = isKrypto ? (majority === 'yes' ? 'UP ↑' : 'DOWN ↓') : (majority === 'yes' ? 'Ja' : 'Nein')
  const minorityLabel = isKrypto ? (majority === 'yes' ? 'DOWN ↓' : 'UP ↑') : (majority === 'yes' ? 'Nein' : 'Ja')
  return (
    <div style={{ padding: '14px 16px', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Aktuelle Positionen</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{total} Trades</span>
      </div>
      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2, marginBottom: 10 }}>
        <div style={{ width: `${yesPct}%`, background: 'var(--yes)', borderRadius: '3px 0 0 3px', transition: 'width 0.4s ease' }} />
        <div style={{ width: `${noPct}%`, background: 'var(--no)', borderRadius: '0 3px 3px 0', transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--yes)' }}>{isKrypto ? 'UP ↑' : 'Ja'} · {yesPct}%</span>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', flex: 1, padding: '0 8px' }}>
          {majorityPct >= 70 && <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontStyle: 'italic' }}>{majorityPct}% setzen auf {majorityLabel} — {minorityLabel}?</span>}
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--no)' }}>{noPct}% · {isKrypto ? 'DOWN ↓' : 'Nein'}</span>
      </div>
    </div>
  )
}

function CountdownDisplay({ targetMs, redThresholdMs = 30000 }: { targetMs: number; redThresholdMs?: number }) {
  const [parts, setParts] = useState({ d: 0, h: 0, m: 0, s: 0, ended: false })
  useEffect(() => {
    const tick = () => {
      const diff = targetMs - Date.now()
      if (diff <= 0) { setParts({ d: 0, h: 0, m: 0, s: 0, ended: true }); return }
      setParts({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        ended: false,
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetMs])

  const diff  = targetMs - Date.now()
  const isRed = diff <= redThresholdMs && !parts.ended

  if (parts.ended) return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>00</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, marginTop: 2 }}>SEK</div>
      </div>
    </div>
  )

  const color = isRed ? '#dc2626' : 'var(--text)'
  const sep = <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-muted)', lineHeight: '36px' }}>:</div>

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {parts.d > 0 && (
        <>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{String(parts.d).padStart(2, '0')}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, marginTop: 4 }}>TAG</div>
          </div>
          {sep}
        </>
      )}
      {(parts.d > 0 || parts.h > 0) && (
        <>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{String(parts.h).padStart(2, '0')}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, marginTop: 4 }}>STD</div>
          </div>
          {sep}
        </>
      )}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{String(parts.m).padStart(2, '0')}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, marginTop: 4 }}>MIN</div>
      </div>
      {sep}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{String(parts.s).padStart(2, '0')}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, marginTop: 4 }}>SEK</div>
      </div>
    </div>
  )
}

function FinanceOutcomeRow({
  label, sublabel, prob, isWinner, isResolved, isActive, color,
  onBuy, onSell, hasPosition, shares,
}: {
  label: string
  sublabel?: string
  prob: number
  isWinner?: boolean
  isResolved: boolean
  isActive: boolean
  color: string
  onBuy: () => void
  onSell: () => void
  hasPosition: boolean
  shares: number
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 120px 180px',
      alignItems: 'center',
      gap: 16,
      padding: '14px 20px',
      borderBottom: '1px solid var(--border)',
      background: isActive ? `${color}08` : 'var(--card)',
      transition: 'background 0.15s',
      opacity: isResolved && !isWinner ? 0.55 : 1,
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{label}</span>
          {sublabel && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sublabel}</span>}
          {isWinner && <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', padding: '1px 7px', borderRadius: 10, background: 'rgba(22,163,74,0.12)' }}>✓ Gewonnen</span>}
          {hasPosition && !isResolved && (
            <span style={{ fontSize: 11, color: color, fontWeight: 600, padding: '1px 7px', borderRadius: 10, background: `${color}18` }}>
              {Math.round(shares)} Anteile
            </span>
          )}
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ width: `${prob}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.4s ease' }} />
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>{prob}%</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{prob}¢</div>
      </div>
      {!isResolved ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onBuy} style={{
            flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 13,
            background: color === '#16a34a' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.12)',
            color, transition: 'background 0.15s',
          }}>
            Kaufen {prob}¢
          </button>
          {hasPosition && (
            <button onClick={onSell} style={{
              padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer',
              fontWeight: 600, fontSize: 12, background: 'var(--surface)', color: 'var(--text-muted)',
            }}>
              Sell
            </button>
          )}
        </div>
      ) : (
        <div />
      )}
    </div>
  )
}

function MarketRules({ description }: { description: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginTop: 24 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', padding: '10px 0',
        }}
      >
        <span style={{
          width: 20, height: 20, borderRadius: 4, background: 'var(--surface)',
          border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 10, color: 'var(--text-muted)',
        }}>
          {open ? '▲' : '▼'}
        </span>
        Auflösungsregeln
      </button>
      {open && (
        <div style={{
          padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.75, whiteSpace: 'pre-wrap',
        }}>
          {description}
        </div>
      )}
    </div>
  )
}

function SpendInput({
  spendRaw, setSpendRaw, spend, setSpend, userBalance,
}: {
  spendRaw: string; setSpendRaw: (v: string) => void
  spend: number; setSpend: (v: number) => void; userBalance: number
}) {
  const handleAdd = (v: number) => {
    const next = Math.min(userBalance, spend + v)
    setSpend(next); setSpendRaw(String(next))
  }
  const handleAllIn = () => { setSpend(userBalance); setSpendRaw(String(userBalance)) }
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Betrag (₫)</div>
        <button onClick={handleAllIn} style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', letterSpacing: 0.3 }}>All-In</button>
      </div>
      <input type="number" min={1} max={userBalance} value={spendRaw}
        onChange={e => { const raw = e.target.value; setSpendRaw(raw); const parsed = parseInt(raw); if (!isNaN(parsed) && parsed >= 1) setSpend(Math.min(userBalance, parsed)) }}
        onBlur={() => { const parsed = parseInt(spendRaw); const safe = isNaN(parsed) || parsed < 1 ? 1 : Math.min(userBalance, parsed); setSpend(safe); setSpendRaw(String(safe)) }}
        style={{ width: '100%', fontSize: 22, fontWeight: 700 }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {[50, 100, 200, 500].map(v => (
          <button key={v} onClick={() => handleAdd(v)} style={{ flex: 1, fontSize: 11, padding: '4px 0', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}>+{v}</button>
        ))}
      </div>
    </div>
  )
}

type Tab       = '7T' | '1M' | 'Gesamt'
type TradeTab  = 'kaufen' | 'verkaufen'
type OrderType = 'markt' | 'limit'

export default function MarketPage() {
  const params   = useParams()
  const router   = useRouter()
  const marketId = params?.id as string

  const [market, setMarket]           = useState<Market | null>(null)
  const [trades, setTrades]           = useState<Trade[]>([])
  const [position, setPosition]       = useState<Position | null>(null)
  const [user, setUser]               = useState<User | null>(null)
  const [loading, setLoading]         = useState(true)
  const [liveMarkets, setLiveMarkets] = useState<Market[]>([])
  const [siblingMarkets, setSiblingMarkets] = useState<Market[]>([])

  const [tradeTab, setTradeTab]     = useState<TradeTab>('kaufen')
  const [orderType, setOrderType]   = useState<OrderType>('markt')
  const [direction, setDirection]   = useState<'yes' | 'no'>('yes')
  const [spend, setSpend]           = useState(100)
  const [spendRaw, setSpendRaw]     = useState('100')
  const [limitPrice, setLimitPrice] = useState(50)
  const [betLoading, setBetLoading] = useState(false)
  const [betError, setBetError]     = useState('')
  const [betSuccess, setBetSuccess] = useState('')

  const [activeTab, setActiveTab]       = useState<Tab>('7T')
  const chartRef                        = useRef<HTMLCanvasElement>(null)
  const chartInstance                   = useRef<unknown>(null)
  const [livePrice, setLivePrice]       = useState<number | null>(null)
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])
  const cryptoCanvasRef                 = useRef<HTMLCanvasElement>(null)
  const priceHistoryRef                 = useRef<PricePoint[]>([])
  const lastRealPrice                   = useRef<number | null>(null)
  const marketRef                       = useRef<Market | null>(null)
  const liveMarketPollRef               = useRef<ReturnType<typeof setInterval> | null>(null)
  const positionRef                     = useRef<Position | null>(null)
  const resolveTriggeredRef             = useRef(false)

  const [resultToast, setResultToast] = useState<ResultToast | null>(null)
  const toastShownRef                 = useRef(false)

  const currentIntervalMs = useRef(10000)
  const intervalRef       = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Kategorie-Flags ───────────────────────────────────────────────────────
  const isFinance  = !!(market?.category === 'finance' || market?.category === 'Finanzen')
  const isFormula1 = market?.category === 'formula1'
  const isWeather  = market?.category === 'weather' || market?.category === 'Wetter'

  function getToken(): string | null {
    try {
      const saved = localStorage.getItem('mobius_session')
      if (!saved) return null
      return JSON.parse(saved).access_token ?? null
    } catch { return null }
  }

  useEffect(() => {
    const saved = localStorage.getItem('mobius_session')
    if (!saved) return
    try {
      const s = JSON.parse(saved)
      if (s?.user_id) dbGet('users', `id=eq.${s.user_id}&select=*`).then(d => { if (d?.[0]) setUser(d[0]) })
    } catch {}
  }, [])

  const loadMarket = useCallback(async () => {
    const data = await dbGet('markets', `id=eq.${marketId}&select=*`)
    if (data?.[0]) { setMarket(data[0]); marketRef.current = data[0] }
    setLoading(false)
  }, [marketId])

  const loadTrades = useCallback(async () => {
    const data = await dbGet('trades', `market_id=eq.${marketId}&select=*&order=created_at.asc`)
    setTrades(data ?? [])
  }, [marketId])

  const loadPosition = useCallback(async (userId: string) => {
    const data = await dbGet('positions', `user_id=eq.${userId}&market_id=eq.${marketId}&select=*`)
    const pos = data?.[0] ?? null
    setPosition(pos); positionRef.current = pos
  }, [marketId])

  const loadLiveMarkets = useCallback(async () => {
    const data = await dbGet('markets', `is_auto=eq.true&resolved=eq.false&select=*&order=closes_at.asc`)
    setLiveMarkets(data ?? [])
  }, [])

  const loadSiblingMarkets = useCallback(async (matchId: string) => {
    const data = await dbGet('markets', `match_id=eq.${matchId}&select=*`)
    setSiblingMarkets(data ?? [])
  }, [])

  useEffect(() => {
    if (market?.match_id) loadSiblingMarkets(market.match_id)
  }, [market?.match_id, loadSiblingMarkets])

  useEffect(() => {
    if (!market?.resolved || toastShownRef.current) return
    if (!market.is_auto) return
    if (isFormula1 || isWeather) return
    toastShownRef.current = true
    const pos       = positionRef.current
    const sharesYes = pos?.shares_yes ?? 0
    const sharesNo  = pos?.shares_no  ?? 0
    const hasPos    = sharesYes > 0 || sharesNo > 0
    const won       = hasPos && ((market.resolution === 'yes' && sharesYes > 0) || (market.resolution === 'no' && sharesNo > 0))
    const amount    = won ? Math.round(market.resolution === 'yes' ? sharesYes : sharesNo) : 0
    const next      = liveMarkets.find(m => m.coin === market.coin && m.id !== marketId)
    setResultToast({ won, amount, resolution: market.resolution ?? '', coin: market.coin, nextMarketId: next?.id })
    if (user?.id) {
      dbGet('users', `id=eq.${user.id}&select=balance`).then(d => {
        if (d?.[0]) setUser(prev => prev ? { ...prev, balance: d[0].balance } : prev)
      })
    }
  }, [market?.resolved, market?.resolution, market?.is_auto, market?.coin, isFormula1, isWeather, liveMarkets, marketId, user?.id])

  useEffect(() => {
    if (!resultToast || resultToast.nextMarketId) return
    const next = liveMarkets.find(m => m.coin === market?.coin && m.id !== marketId)
    if (next) setResultToast(prev => prev ? { ...prev, nextMarketId: next.id } : prev)
  }, [liveMarkets, resultToast, market?.coin, marketId])

  useEffect(() => {
    loadMarket(); loadTrades(); loadLiveMarkets()
    const startInterval = (ms: number) => {
      if (ms === currentIntervalMs.current && intervalRef.current !== null) return
      currentIntervalMs.current = ms
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => { loadMarket(); loadTrades(); loadLiveMarkets() }, ms)
    }
    startInterval(10000)
    const watchdog = setInterval(() => {
      const m = marketRef.current
      if (!m) return
      const diff = parseUTC(m.closes_at).getTime() - Date.now()
      if (m.resolved) {
        startInterval(10000)
        if (!liveMarketPollRef.current) liveMarketPollRef.current = setInterval(() => { loadLiveMarkets() }, 1000)
      } else if (diff <= 0) {
        startInterval(2000)
        if (!liveMarketPollRef.current) liveMarketPollRef.current = setInterval(() => { loadLiveMarkets(); loadMarket() }, 1000)
      } else if (diff <= 30000) {
        startInterval(5000)
      } else {
        startInterval(10000)
      }
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null; currentIntervalMs.current = 10000
      clearInterval(watchdog)
      if (liveMarketPollRef.current) clearInterval(liveMarketPollRef.current)
    }
  }, [loadMarket, loadTrades, loadLiveMarkets])

  useEffect(() => {
    if (!market?.resolved) return
    const found = liveMarkets.find(m => m.coin === market.coin && m.id !== marketId)
    if (found && liveMarketPollRef.current) { clearInterval(liveMarketPollRef.current); liveMarketPollRef.current = null }
  }, [liveMarkets, market, marketId])

  useEffect(() => {
    if (user?.id) loadPosition(user.id)
  }, [user, loadPosition])

  useEffect(() => {
    if (!market?.resolved || !user?.id) return
    dbGet('users', `id=eq.${user.id}&select=balance`).then(d => {
      if (d?.[0]) setUser(prev => prev ? { ...prev, balance: d[0].balance } : prev)
    })
    loadPosition(user.id)
  }, [market?.resolved, user?.id, loadPosition])

  useEffect(() => {
    if (!market?.is_auto || !market?.coin || market?.resolved) return
    if (market?.match_id) return
    if (isFormula1 || isWeather) return  // Wetter hat keinen Live-Preis-Feed

    const coin            = market.coin
    const marketEndMs     = parseUTC(market.closes_at).getTime()
    const isFinanceMarket = market.category === 'finance' || market.category === 'Finanzen'

    const fetchPrice = async (): Promise<number | null> => {
      if (Date.now() > marketEndMs) return null
      return isFinanceMarket ? fetchFinancePrice(coin) : fetchCoinbasePrice(coin)
    }
    const fetchReal = async () => {
      const price = await fetchPrice()
      if (price === null) return
      lastRealPrice.current = price
      const point: PricePoint = { t: Math.min(Date.now(), marketEndMs), price }
      priceHistoryRef.current = [...priceHistoryRef.current, point].slice(-300)
      setPriceHistory([...priceHistoryRef.current]); setLivePrice(price)
    }
    fetchReal()
    const fetchInterval  = setInterval(() => { if (Date.now() > marketEndMs) { clearInterval(fetchInterval); clearInterval(interpInterval); return }; fetchReal() }, 10000)
    const interpInterval = setInterval(() => {
      if (Date.now() > marketEndMs) return
      if (lastRealPrice.current === null) return
      const hist = priceHistoryRef.current
      const last = hist.length > 0 ? hist[hist.length - 1].price : lastRealPrice.current
      const jitter = last * 0.00008 * (Math.random() * 2 - 1)
      const point: PricePoint = { t: Math.min(Date.now(), marketEndMs), price: last + jitter }
      priceHistoryRef.current = [...priceHistoryRef.current, point].slice(-300)
      setPriceHistory([...priceHistoryRef.current]); setLivePrice(last + jitter)
    }, 1000)
    return () => { clearInterval(fetchInterval); clearInterval(interpInterval) }
  }, [market?.is_auto, market?.coin, market?.resolved, market?.closes_at, market?.match_id, market?.category, isFormula1, isWeather])

  useEffect(() => {
    if (!market?.is_auto || !cryptoCanvasRef.current || !market?.start_price || !market?.closes_at) return
    if (market?.match_id) return
    if (market?.category === 'finance' || market?.category === 'Finanzen') return
    if (isFormula1 || isWeather) return

    const marketEndMs      = parseUTC(market.closes_at).getTime()
    const marketDurationMs = 3 * 60 * 1000
    const marketStartMs    = marketEndMs - marketDurationMs
    const anchorPoint: PricePoint = { t: marketStartMs, price: market.start_price }
    const fullHistory = priceHistory.length > 0 ? [anchorPoint, ...priceHistory.filter(p => p.t > marketStartMs)] : [anchorPoint]
    const chartEnd = market.resolved ? marketEndMs : Date.now()
    drawCryptoChart(cryptoCanvasRef.current, fullHistory, market.start_price, marketStartMs, chartEnd)
  }, [priceHistory, market?.is_auto, market?.start_price, market?.closes_at, market?.resolved, market?.match_id, market?.category, isFormula1, isWeather])

  useEffect(() => {
    if (!market?.closes_at || !market?.coin || !market?.id) return
    if (market?.match_id) return
    if (isFinance || isFormula1 || isWeather) return

    resolveTriggeredRef.current = false
    const closesAt = parseUTC(market.closes_at)
    const mktId    = market.id
    const tick = async () => {
      const diff = closesAt.getTime() - Date.now()
      if (diff <= 0 && !resolveTriggeredRef.current) {
        resolveTriggeredRef.current = true
        try { await fetch('/api/resolve-crypto-market', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ market_id: mktId }) }) } catch {}
        loadMarket()
        if (user?.id) { dbGet('users', `id=eq.${user?.id}&select=balance`).then(d => { if (d?.[0]) setUser(prev => prev ? { ...prev, balance: d[0].balance } : prev) }) }
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [market?.closes_at, market?.coin, market?.id, market?.match_id, isFinance, isFormula1, isWeather, loadMarket, user?.id])

  const [liveScore, setLiveScore] = useState<{ home: number; away: number } | null>(null)

  useEffect(() => {
    if (!market?.match_id || market?.resolved) return
    const matchIdNum = market.match_id.replace('bl1-', '')
    const fetchScore = async () => {
      try {
        const season = new Date().getMonth() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1
        const res = await fetch(`https://api.openligadb.de/getmatchdata/bl1/${season}`, { cache: 'no-store' })
        if (!res.ok) return
        const matches = await res.json()
        const match = matches.find((m: { matchID: number }) => String(m.matchID) === matchIdNum)
        if (!match) return
        const goals = match.goals ?? []
        if (goals.length === 0 && !match.matchIsFinished) return
        const final = match.matchResults?.find((r: { resultTypeID: number }) => r.resultTypeID === 2)
        if (final) setLiveScore({ home: final.pointsTeam1, away: final.pointsTeam2 })
        else if (goals.length > 0) { const last = goals[goals.length - 1]; setLiveScore({ home: last.scoreTeam1, away: last.scoreTeam2 }) }
      } catch {}
    }
    fetchScore()
    const id = setInterval(fetchScore, 60000)
    return () => clearInterval(id)
  }, [market?.match_id, market?.resolved])

  const tradeHistory = (() => {
    if (!market || trades.length === 0) return []
    let qY = 0, qN = 0
    return trades.filter(t => t.shares > 0 && (t.type === 'buy_yes' || t.type === 'buy_no')).map(t => {
      if (t.type === 'buy_yes') qY += t.shares; else qN += t.shares
      return { t: t.created_at, prob: calcProb(qY, qN, market.b) }
    })
  })()

  useEffect(() => {
    if (market?.is_auto) return
    if (!chartRef.current || tradeHistory.length === 0) return
    const build = async () => {
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)
      const now        = new Date()
      const since      = activeTab === '7T' ? new Date(now.getTime() - 7 * 24 * 3600 * 1000) : activeTab === '1M' ? new Date(now.getTime() - 30 * 24 * 3600 * 1000) : new Date(0)
      const pts        = tradeHistory.filter(p => new Date(p.t) >= since)
      const dataPoints = pts.length > 0 ? pts : tradeHistory.slice(-10)
      const isDark     = document.documentElement.getAttribute('data-theme') === 'dark'
      const gridColor  = isDark ? '#2a2d3a' : '#e8eaef'
      const tickColor  = isDark ? '#94a3b8' : '#9ca3af'
      if (chartInstance.current) (chartInstance.current as { destroy: () => void }).destroy()
      chartInstance.current = new Chart(chartRef.current!, {
        type: 'line',
        data: {
          labels: dataPoints.map(p => { const d = new Date(p.t); return activeTab === 'Gesamt' ? d.toLocaleDateString('de', { month: 'short', day: 'numeric' }) : d.toLocaleDateString('de', { day: '2-digit', month: '2-digit' }) }),
          datasets: [{ data: dataPoints.map(p => p.prob), borderColor: '#12b76a', backgroundColor: isDark ? 'rgba(18,183,106,0.08)' : 'rgba(18,183,106,0.10)', fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.4 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 350 },
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.parsed.y}% Ja` } } },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11 }, maxTicksLimit: 6 } },
            y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11 }, callback: v => `${v}%` } },
          },
        },
      })
    }
    build()
    return () => { if (chartInstance.current) (chartInstance.current as { destroy: () => void }).destroy() }
  }, [tradeHistory, activeTab, market?.is_auto])

  async function handleKaufen() {
    if (!user || !market) return
    if (spend <= 0 || spend > 1000000) { setBetError('Ungültiger Betrag.'); return }
    if (user.balance < spend) { setBetError('Nicht genug Guthaben.'); return }
    setBetLoading(true); setBetError('')
    if (orderType === 'limit') { setBetSuccess(`Limit-Order bei ${limitPrice}¢ platziert.`); setBetLoading(false); setTimeout(() => setBetSuccess(''), 4000); return }
    const token = getToken()
    if (!token) { setBetError('Sitzung abgelaufen — bitte erneut anmelden.'); setBetLoading(false); return }
    const res = await fetch('/api/place-bet', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ marketId, action: 'buy', direction, spend }) })
    const data = await res.json()
    if (!res.ok) {
      if (res.status === 401 || data.error?.toLowerCase().includes('session') || data.error?.toLowerCase().includes('token')) { localStorage.removeItem('mobius_session'); setBetError('Sitzung abgelaufen — bitte neu anmelden.') }
      else { setBetError(data.error ?? 'Fehler beim Platzieren.') }
      setBetLoading(false); return
    }
    setUser(prev => prev ? { ...prev, balance: data.newBalance } : prev)
    setBetSuccess('Wette platziert ✓'); setBetLoading(false)
    loadMarket(); loadTrades(); loadPosition(user.id)
    if (market.match_id) loadSiblingMarkets(market.match_id)
    setTimeout(() => setBetSuccess(''), 2500)
  }

  async function handleVerkaufen() {
    if (!user || !market || !position) return
    setBetLoading(true); setBetError('')
    const token = getToken()
    if (!token) { setBetError('Sitzung abgelaufen — bitte erneut anmelden.'); setBetLoading(false); return }
    const res = await fetch('/api/place-bet', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ marketId, action: 'sell', direction, spend }) })
    const data = await res.json()
    if (!res.ok) {
      if (res.status === 401 || data.error?.toLowerCase().includes('session') || data.error?.toLowerCase().includes('token')) { localStorage.removeItem('mobius_session'); setBetError('Sitzung abgelaufen — bitte neu anmelden.') }
      else { setBetError(data.error ?? 'Fehler beim Verkaufen.') }
      setBetLoading(false); return
    }
    setUser(prev => prev ? { ...prev, balance: data.newBalance } : prev)
    setBetSuccess(`${data.returned} ₫ erhalten ✓`); setBetLoading(false)
    loadMarket(); loadTrades(); loadPosition(user.id)
    setTimeout(() => setBetSuccess(''), 2500)
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>Let the AI cook...</div>
  if (!market) return (
    <div style={{ padding: 32 }}>
      <div style={{ color: 'var(--no)', fontSize: 14, marginBottom: 16 }}>Markt nicht gefunden.</div>
      <button className="nav-pill" onClick={() => router.push('/')}>← Zurück</button>
    </div>
  )

  const isSoccer    = !!market.match_id
  // isKrypto: is_auto, kein Soccer, kein Finance, kein Formula1, kein Weather
  const isKrypto    = !!market.is_auto && !isSoccer && !isFinance && !isFormula1 && !isWeather
  const prob        = calcProb(market.q_yes, market.q_no, market.b)
  const isLow       = prob < 50
  const catClass    = CAT_CLASS[market.category ?? ''] ?? ''
  const payout      = Math.round(lmsrSharesForSpend(market.q_yes, market.q_no, market.b, direction, spend))
  const sharesYes   = position?.shares_yes ?? 0
  const sharesNo    = position?.shares_no  ?? 0
  const hasPosition = sharesYes > 0 || sharesNo > 0
  const sellSide    = sharesYes >= sharesNo ? 'yes' : 'no'
  const sellShares  = sellSide === 'yes' ? sharesYes : sharesNo
  const returnOnSell = hasPosition ? lmsrSellReturn(market.q_yes, market.q_no, market.b, sellSide, sellShares) : 0
  const closesAt    = parseUTC(market.closes_at)
  const closesAtMs  = closesAt.getTime()
  const delta       = livePrice && market.start_price ? livePrice - market.start_price : null
  const endDelta    = market.end_price && market.start_price ? market.end_price - market.start_price : null
  const isUp        = delta !== null ? delta >= 0 : (endDelta !== null ? endDelta >= 0 : true)

  const nextLiveMarket   = liveMarkets.find(m => m.coin === market.coin && m.id !== marketId)
  const otherLiveMarkets = liveMarkets.filter(m => m.coin !== market.coin).slice(0, 4)
  void otherLiveMarkets

  const userWon = market.resolved && hasPosition &&
    ((market.resolution === 'yes' && sharesYes > 0) || (market.resolution === 'no' && sharesNo > 0))
  const showEndedBanner = market.resolved || closesAtMs < Date.now()

  const soccerTeams = market.display_group?.split(' vs ') ?? []
  const homeTeam    = soccerTeams[0] ?? ''
  const awayTeam    = soccerTeams[1] ?? ''

  const homeMarket = siblingMarkets.find(m => m.outcome === 'home')
  const drawMarket = siblingMarkets.find(m => m.outcome === 'draw')
  const awayMarket = siblingMarkets.find(m => m.outcome === 'away')

  const homeProb  = homeMarket ? calcProb(homeMarket.q_yes, homeMarket.q_no, homeMarket.b) : 33
  const drawProb  = drawMarket ? calcProb(drawMarket.q_yes, drawMarket.q_no, drawMarket.b) : 34
  const awayProb  = awayMarket ? calcProb(awayMarket.q_yes, awayMarket.q_no, awayMarket.b) : 33
  const totalProb = homeProb + drawProb + awayProb
  const homeNorm  = Math.round((homeProb / totalProb) * 100)
  const drawNorm  = Math.round((drawProb / totalProb) * 100)
  const awayNorm  = 100 - homeNorm - drawNorm

  const thisOutcome      = market.outcome
  const soccerIsInactive = market.resolved || closesAtMs < Date.now()

  const soccerResolutionLabel = () => {
    if (!market.resolved) return ''
    if (market.resolution === 'yes') {
      if (thisOutcome === 'home') return `${homeTeam} gewinnt ✓`
      if (thisOutcome === 'draw') return 'Unentschieden ✓'
      if (thisOutcome === 'away') return `${awayTeam} gewinnt ✓`
    }
    if (market.resolution === 'draw') return 'Einsatz zurück'
    return 'Nicht eingetreten'
  }

  const autoMarketTitle = isFinance
    ? `${market.short_label ?? market.coin} · ${market.group_title ?? ''}`
    : `${market.coin} Up or Down – 3 Minuten`

  // ── Navigation ────────────────────────────────────────────────────────────
  const backLabel = isSoccer
    ? '← Zurück zur Bundesliga'
    : isFinance
    ? '← Zurück zu Finanzen'
    : isFormula1
    ? '← Zurück zu Formel 1'
    : isWeather
    ? '← Zurück zu Wetter'
    : market.category
    ? `← Zurück zu ${market.category}`
    : '← Zurück'

  const backTarget = isSoccer
    ? '/?category=Bundesliga'
    : isFinance
    ? `/?category=Finanzen-${market.group_title === 'Aktueller Handelstag' ? 'Tag' : 'Woche'}`
    : isFormula1
    ? '/?category=F1'
    : isWeather
    ? '/?category=Wetter'
    : market.category
    ? `/?category=${encodeURIComponent(market.category)}`
    : '/'

  const toastIsUp    = resultToast?.resolution === 'yes'
  const toastColor   = toastIsUp ? '#16a34a' : '#dc2626'
  const toastLabel   = resultToast?.coin
    ? (toastIsUp ? `${resultToast.coin} · UP ↑` : `${resultToast.coin} · DOWN ↓`)
    : (resultToast?.won ? 'POSITION GEWONNEN' : 'POSITION VERLOREN')

  const displayPrice   = market.resolved ? market.end_price : (livePrice ?? market.start_price)
  const displayDelta   = displayPrice && market.start_price ? displayPrice - market.start_price : null
  const displayIsUp    = displayDelta !== null ? displayDelta >= 0 : true
  const financeIsEnded = market.resolved || closesAtMs < Date.now()

  // Wiederverwendbares Trade-Panel (Soccer, Normal, Weather teilen dieselbe Logik)
  const renderTradePanel = (resolvedLabel?: string) => (
    <div className="card" style={{ position: 'sticky', top: 'calc(var(--nav-height) + 16px)', padding: 0, overflow: 'hidden' }}>
      {(market.resolved || closesAtMs < Date.now()) ? (
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>{userWon ? '🎉' : hasPosition ? '😔' : '✓'}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{userWon ? 'Gewonnen!' : hasPosition ? 'Verloren' : 'Markt beendet'}</div>
          {resolvedLabel && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{resolvedLabel}</div>}
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Ergebnis: <strong style={{ color: market.resolution === 'yes' ? 'var(--yes)' : 'var(--no)', fontSize: 15 }}>{market.resolution === 'yes' ? 'Ja ✓' : 'Nein'}</strong>
          </div>
          {hasPosition && (
            <div style={{ padding: '14px', borderRadius: 10, textAlign: 'center', marginTop: 12, marginBottom: 14, background: userWon ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${userWon ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}` }}>
              {userWon ? (<><div style={{ fontSize: 12, color: '#16a34a', marginBottom: 4 }}>Auszahlung erfolgt automatisch</div><div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a' }}>+{Math.round(market.resolution === 'yes' ? sharesYes : sharesNo)} ₫</div></>) : (<div style={{ fontSize: 13, color: '#dc2626' }}>Leider verloren — nächsten Markt versuchen!</div>)}
            </div>
          )}
          <button onClick={() => router.push(backTarget)} style={{ width: '100%', padding: '12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, marginTop: 8 }}>
            Weitere Möbius-Märkte →
          </button>
        </div>
      ) : !user ? (
        <div style={{ textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>Anmelden um zu handeln</div>
          <button className="submit-btn yes" onClick={() => router.push('/')}>Zur Anmeldung</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
            <div style={{ display: 'flex' }}>
              {(['kaufen', 'verkaufen'] as TradeTab[]).map(t => (
                <button key={t} onClick={() => { setTradeTab(t); setBetError(''); setBetSuccess('') }}
                  style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: 'transparent', color: tradeTab === t ? 'var(--text)' : 'var(--text-muted)', borderBottom: tradeTab === t ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1 }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: 16 }}>
            {tradeTab === 'kaufen' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  {(['yes', 'no'] as const).map(d => (
                    <button key={d} onClick={() => setDirection(d)} style={{ padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, background: direction === d ? (d === 'yes' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)') : 'var(--surface)', color: direction === d ? (d === 'yes' ? 'var(--yes)' : 'var(--no)') : 'var(--text-muted)', outline: direction === d ? `2px solid ${d === 'yes' ? 'var(--yes)' : 'var(--no)'}` : '2px solid transparent' }}>
                      {d === 'yes' ? `Ja · ${prob}¢` : `Nein · ${100 - prob}¢`}
                    </button>
                  ))}
                </div>
                <SpendInput spendRaw={spendRaw} setSpendRaw={setSpendRaw} spend={spend} setSpend={setSpend} userBalance={user.balance} />
                <div style={{ background: 'rgba(22,163,74,0.07)', borderRadius: 10, padding: '14px', marginBottom: 14, textAlign: 'center', border: '1px solid rgba(22,163,74,0.2)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Auszahlung wenn Ja eintritt</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#16a34a', letterSpacing: '-0.5px' }}>{payout} ₫</div>
                </div>
              </>
            )}
            {tradeTab === 'verkaufen' && (
              <>
                {!hasPosition ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'var(--text-muted)' }}>Du hast keine Anteile in diesem Markt.</div>
                ) : (
                  <>
                    <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '12px', marginBottom: 16, fontSize: 13 }}>
                      <div style={{ color: 'var(--text-muted)', marginBottom: 4, fontSize: 12 }}>Deine Position</div>
                      {sharesYes > 0 && <div style={{ fontWeight: 700, color: 'var(--yes)' }}>Ja · {Math.round(sharesYes)} Anteile</div>}
                      {sharesNo  > 0 && <div style={{ fontWeight: 700, color: 'var(--no)'  }}>Nein · {Math.round(sharesNo)} Anteile</div>}
                    </div>
                    <div style={{ background: 'rgba(22,163,74,0.07)', borderRadius: 10, padding: '14px', marginBottom: 14, textAlign: 'center', border: '1px solid rgba(22,163,74,0.2)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Du erhältst jetzt</div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: '#16a34a', letterSpacing: '-0.5px' }}>{Math.round(returnOnSell)} ₫</div>
                      <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 4 }}>alle Anteile verkaufen</div>
                    </div>
                  </>
                )}
              </>
            )}
            {betError   && <div className="alert alert-error"   style={{ marginBottom: 10 }}>{betError}</div>}
            {betSuccess  && <div className="alert alert-success" style={{ marginBottom: 10 }}>{betSuccess}</div>}
            {tradeTab === 'kaufen' ? (
              <button className={`submit-btn ${direction === 'yes' ? 'yes' : 'no'}`} onClick={handleKaufen} disabled={betLoading || spend <= 0} style={{ width: '100%' }}>
                {betLoading ? 'Wird ausgeführt…' : `${direction === 'yes' ? 'Ja' : 'Nein'} kaufen · ${spend} ₫`}
              </button>
            ) : (
              <button className="submit-btn no" onClick={handleVerkaufen} disabled={betLoading || !hasPosition} style={{ width: '100%' }}>
                {betLoading ? 'Wird verkauft…' : `Verkaufen · ${Math.round(returnOnSell)} ₫`}
              </button>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-subtle)', textAlign: 'center', marginTop: 8 }}>Guthaben: {user.balance.toLocaleString('de')} ₫</div>
          </div>
        </>
      )}
    </div>
  )

  return (
    <>
      {resultToast && !isSoccer && !isFormula1 && !isWeather && (
        <div style={{ position: 'fixed', top: 80, right: 16, zIndex: 9999, background: 'var(--bg, #fff)', border: `1px solid ${toastIsUp ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`, borderLeft: `4px solid ${toastColor}`, borderRadius: 14, padding: '16px 18px', minWidth: 280, maxWidth: 340, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', animation: 'slideInRight 0.35s cubic-bezier(.21,1.02,.73,1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {resultToast.coin && (<span style={{ width: 28, height: 28, borderRadius: 7, background: COIN_COLORS[resultToast.coin] ?? '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>{resultToast.coin.charAt(0)}</span>)}
              <span style={{ fontSize: 14, fontWeight: 700, color: toastColor }}>{toastLabel}</span>
            </div>
            <button onClick={() => setResultToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#9ca3af', padding: 0, lineHeight: 1 }}>×</button>
          </div>
          {resultToast.won && resultToast.amount > 0 && (<div style={{ fontSize: 30, fontWeight: 800, color: toastColor, letterSpacing: '-0.5px', marginBottom: 12, lineHeight: 1 }}>+{resultToast.amount.toLocaleString('de')} ₫</div>)}
          {resultToast.nextMarketId ? (
            <button onClick={() => { setResultToast(null); router.push(`/markets/${resultToast.nextMarketId}`) }} style={{ width: '100%', padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />Zum Live-Markt →
            </button>
          ) : (<div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>Nächster Markt wird erstellt…</div>)}
        </div>
      )}

      <nav className="nav">
        <div className="nav-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-weiss.png" alt="Möbius" className="nav-logo" onClick={() => router.push('/')} style={{ cursor: 'pointer' }} />
          <button className="nav-pill" onClick={() => router.push(backTarget)} style={{ fontSize: 13 }}>{backLabel}</button>
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

        {/* ── SOCCER ── */}
        {isSoccer && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Sport</span><span>·</span><span>{market.group_title ?? 'Bundesliga'}</span>
            </div>
            {soccerIsInactive && (
              <div style={{ marginBottom: 16, padding: '14px 20px', borderRadius: 12, background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.25)' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-muted)' }}>Dieser Möbius-Markt ist nicht mehr aktiv</span>
              </div>
            )}
            <div className="card" style={{ marginBottom: 20 }}>
              {!soccerIsInactive && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Schließt in</div>
                  <CountdownDisplay targetMs={closesAtMs} />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, marginBottom: 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flex: 1 }}>
                  <TeamIcon name={homeTeam} size={64} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textAlign: 'center', maxWidth: 120, lineHeight: 1.3 }}>{homeTeam}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: getTeamColor(homeTeam) }}>{homeNorm}%</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  {liveScore ? (
                    <><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 1, marginBottom: 2 }}>LIVE</div><div style={{ fontSize: 36, fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1 }}>{liveScore.home} : {liveScore.away}</div><div style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />Zwischenstand</div></>
                  ) : (
                    <><div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 1 }}>VS</div><div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Unentschieden</div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-muted)' }}>{drawNorm}%</div></>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flex: 1 }}>
                  <TeamIcon name={awayTeam} size={64} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textAlign: 'center', maxWidth: 120, lineHeight: 1.3 }}>{awayTeam}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: getTeamColor(awayTeam) }}>{awayNorm}%</div>
                </div>
              </div>
              <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2, marginBottom: 8 }}>
                <div style={{ width: `${homeNorm}%`, background: getTeamColor(homeTeam), borderRadius: '3px 0 0 3px' }} />
                <div style={{ width: `${drawNorm}%`, background: '#94a3b8' }} />
                <div style={{ width: `${awayNorm}%`, background: getTeamColor(awayTeam), borderRadius: '0 3px 3px 0' }} />
              </div>
              {market.resolved && (
                <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: market.resolution === 'yes' ? 'rgba(22,163,74,0.1)' : market.resolution === 'draw' ? 'rgba(245,158,11,0.1)' : 'rgba(220,38,38,0.1)', border: `1px solid ${market.resolution === 'yes' ? 'rgba(22,163,74,0.3)' : market.resolution === 'draw' ? 'rgba(245,158,11,0.3)' : 'rgba(220,38,38,0.3)'}`, textAlign: 'center', fontSize: 14, fontWeight: 700, color: market.resolution === 'yes' ? '#16a34a' : market.resolution === 'draw' ? '#b45309' : '#dc2626' }}>
                  {soccerResolutionLabel()}
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Auf welchen Ausgang tippst du?</div>
                {[
                  { outcome: 'home', market: homeMarket, label: homeTeam, prob: homeNorm, color: getTeamColor(homeTeam) },
                  { outcome: 'draw', market: drawMarket, label: 'Unentschieden', prob: drawNorm, color: '#64748b' },
                  { outcome: 'away', market: awayMarket, label: awayTeam, prob: awayNorm, color: getTeamColor(awayTeam) },
                ].map(opt => {
                  const isActive = thisOutcome === opt.outcome; const isResolved = opt.market?.resolved; const won = isResolved && opt.market?.resolution === 'yes'
                  return (
                    <div key={opt.outcome} onClick={() => { if (opt.market && opt.market.id !== marketId) router.push(`/markets/${opt.market.id}`) }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderRadius: 14, cursor: opt.market?.id !== marketId ? 'pointer' : 'default', border: isActive ? `2px solid ${opt.color}` : '2px solid var(--border)', background: isActive ? `${opt.color}10` : 'var(--card)', transition: 'all 0.15s', opacity: isResolved && !won ? 0.6 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        {opt.outcome === 'draw' ? (<div style={{ width: 44, height: 44, borderRadius: 11, background: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#fff', flexShrink: 0 }}>X</div>) : (<TeamIcon name={opt.label} size={44} />)}
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{opt.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{isResolved ? (won ? '✓ Gewonnen' : 'Nicht eingetreten') : `${opt.market ? Math.round(opt.market.q_yes + opt.market.q_no).toLocaleString('de') : 0} ₫ Volumen`}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: opt.color, letterSpacing: '-0.5px' }}>{opt.prob}%</div>
                        {isActive && !isResolved && <div style={{ fontSize: 11, color: opt.color, fontWeight: 600 }}>← Aktiv</div>}
                        {won && <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>Gewonnen ✓</div>}
                      </div>
                    </div>
                  )
                })}
                {!market.resolved && <LivePositionsBar trades={trades} isKrypto={false} />}
                {trades.filter(t => t.shares > 0).length > 0 && (
                  <div className="card" style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Letzte Trades</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[...trades].filter(t => t.shares > 0).reverse().slice(0, 8).map(t => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ color: t.type.includes('yes') ? 'var(--yes)' : 'var(--no)', fontWeight: 600 }}>{t.type.includes('yes') ? 'Ja' : 'Nein'}</span>
                          <span style={{ color: 'var(--text)' }}>{Math.round(Math.abs(t.cost))} ₫</span>
                          <span style={{ color: 'var(--text-subtle)' }}>{new Date(t.created_at).toLocaleDateString('de', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {soccerIsInactive ? (
                <div className="card" style={{ padding: '24px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{userWon ? 'Gewonnen!' : hasPosition ? 'Verloren' : 'Markt nicht mehr aktiv'}</div>
                  {market.resolved && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{soccerResolutionLabel()}</div>}
                  {userWon && <div style={{ fontSize: 32, fontWeight: 800, color: '#16a34a', letterSpacing: '-0.5px', marginBottom: 16 }}>+{Math.round(market.resolution === 'yes' ? sharesYes : sharesNo)} ₫</div>}
                  <button onClick={() => router.push('/')} style={{ width: '100%', padding: '12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Weitere Möbius-Märkte →</button>
                </div>
              ) : (
                <div className="card" style={{ position: 'sticky', top: 'calc(var(--nav-height) + 16px)', padding: 0, overflow: 'hidden' }}>
                  {!user ? (
                    <div style={{ textAlign: 'center', padding: '24px 16px' }}>
                      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>Anmelden um zu tippen</div>
                      <button className="submit-btn yes" onClick={() => router.push('/')}>Zur Anmeldung</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Du tippst auf</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{thisOutcome === 'home' ? homeTeam : thisOutcome === 'away' ? awayTeam : 'Unentschieden'}</div>
                      </div>
                      <div style={{ padding: 16 }}>
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16, marginLeft: -16, marginRight: -16, paddingLeft: 16 }}>
                          {(['kaufen', 'verkaufen'] as TradeTab[]).map(t => (
                            <button key={t} onClick={() => { setTradeTab(t); setBetError(''); setBetSuccess('') }}
                              style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: 'transparent', color: tradeTab === t ? 'var(--text)' : 'var(--text-muted)', borderBottom: tradeTab === t ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1 }}>
                              {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                          ))}
                        </div>
                        {tradeTab === 'kaufen' && (
                          <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                              {(['yes', 'no'] as const).map(d => (
                                <button key={d} onClick={() => setDirection(d)} style={{ padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: direction === d ? (d === 'yes' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)') : 'var(--surface)', color: direction === d ? (d === 'yes' ? 'var(--yes)' : 'var(--no)') : 'var(--text-muted)', outline: direction === d ? `2px solid ${d === 'yes' ? 'var(--yes)' : 'var(--no)'}` : '2px solid transparent' }}>
                                  {d === 'yes' ? `Ja · ${prob}¢` : `Nein · ${100 - prob}¢`}
                                </button>
                              ))}
                            </div>
                            <SpendInput spendRaw={spendRaw} setSpendRaw={setSpendRaw} spend={spend} setSpend={setSpend} userBalance={user.balance} />
                            <div style={{ background: 'rgba(22,163,74,0.07)', borderRadius: 10, padding: '14px', marginBottom: 14, textAlign: 'center', border: '1px solid rgba(22,163,74,0.2)' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Auszahlung wenn {direction === 'yes' ? (thisOutcome === 'home' ? homeTeam : thisOutcome === 'away' ? awayTeam : 'Unentschieden') : 'anderer Ausgang'} eintritt</div>
                              <div style={{ fontSize: 32, fontWeight: 800, color: '#16a34a', letterSpacing: '-0.5px' }}>{payout} ₫</div>
                            </div>
                          </>
                        )}
                        {tradeTab === 'verkaufen' && (
                          <>
                            {!hasPosition ? (<div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'var(--text-muted)' }}>Du hast keine Anteile in diesem Markt.</div>) : (
                              <>
                                <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '12px', marginBottom: 16, fontSize: 13 }}>
                                  <div style={{ color: 'var(--text-muted)', marginBottom: 4, fontSize: 12 }}>Deine Position</div>
                                  {sharesYes > 0 && <div style={{ fontWeight: 700, color: 'var(--yes)' }}>Ja · {Math.round(sharesYes)} Anteile</div>}
                                  {sharesNo  > 0 && <div style={{ fontWeight: 700, color: 'var(--no)'  }}>Nein · {Math.round(sharesNo)} Anteile</div>}
                                </div>
                                <div style={{ background: 'rgba(22,163,74,0.07)', borderRadius: 10, padding: '14px', marginBottom: 14, textAlign: 'center', border: '1px solid rgba(22,163,74,0.2)' }}>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Du erhältst jetzt</div>
                                  <div style={{ fontSize: 32, fontWeight: 800, color: '#16a34a', letterSpacing: '-0.5px' }}>{Math.round(returnOnSell)} ₫</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 4 }}>alle Anteile verkaufen</div>
                                </div>
                              </>
                            )}
                          </>
                        )}
                        {betError   && <div className="alert alert-error"   style={{ marginBottom: 10 }}>{betError}</div>}
                        {betSuccess  && <div className="alert alert-success" style={{ marginBottom: 10 }}>{betSuccess}</div>}
                        {tradeTab === 'kaufen' ? (
                          <button className={`submit-btn ${direction === 'yes' ? 'yes' : 'no'}`} onClick={handleKaufen} disabled={betLoading || spend <= 0} style={{ width: '100%' }}>
                            {betLoading ? 'Wird ausgeführt…' : `${direction === 'yes' ? 'Ja' : 'Nein'} kaufen · ${spend} ₫`}
                          </button>
                        ) : (
                          <button className="submit-btn no" onClick={handleVerkaufen} disabled={betLoading || !hasPosition} style={{ width: '100%' }}>
                            {betLoading ? 'Wird verkauft…' : `Verkaufen · ${Math.round(returnOnSell)} ₫`}
                          </button>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--text-subtle)', textAlign: 'center', marginTop: 8 }}>Guthaben: {user.balance.toLocaleString('de')} ₫</div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── FINANCE ── */}
        {isFinance && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Finanzen</span><span>·</span><span>{market.short_label ?? market.coin}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 48, height: 48, borderRadius: 12, background: COIN_COLORS[market.coin ?? ''] ?? '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {market.short_label?.charAt(0) ?? market.coin?.charAt(0) ?? '₿'}
                  </span>
                  <div>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2, margin: 0 }}>{autoMarketTitle}</h1>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      {market.group_title === 'Aktueller Handelstag' ? 'Tagesschluss' : 'Wochenschluss'} ·{' '}
                      {closesAt.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })}
                    </div>
                  </div>
                </div>
                {!financeIsEnded && (<div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Verbleibend</div><CountdownDisplay targetMs={closesAtMs} redThresholdMs={300000} /></div>)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 32, padding: '16px 20px', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Startpreis</div><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>${market.start_price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}</div></div>
              <div style={{ width: 1, height: 40, background: 'var(--border)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {market.resolved ? 'Endpreis' : 'Aktueller Preis'}
                  {displayDelta !== null && (<span style={{ color: displayIsUp ? '#16a34a' : '#dc2626', fontWeight: 700, fontSize: 12, padding: '1px 6px', borderRadius: 6, background: displayIsUp ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)' }}>{displayIsUp ? '▲' : '▼'} ${Math.abs(displayDelta).toFixed(2)}</span>)}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: market.resolved ? 'var(--text)' : (displayIsUp ? '#16a34a' : '#dc2626'), transition: 'color 0.3s' }}>
                  {displayPrice ? `$${displayPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Lädt…'}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Volumen</div><div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{Math.round(market.q_yes + market.q_no).toLocaleString('de')} ₫</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{trades.filter(t => t.shares > 0).length} Trades</div></div>
            </div>
            {financeIsEnded && (
              <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12, background: market.resolved ? (market.resolution === 'yes' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)') : 'rgba(245,158,11,0.1)', border: `1px solid ${market.resolved ? (market.resolution === 'yes' ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)') : 'rgba(245,158,11,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>{market.resolved ? (market.resolution === 'yes' ? '↑' : '↓') : '⏳'}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: market.resolved ? (market.resolution === 'yes' ? '#16a34a' : '#dc2626') : '#b45309' }}>{market.resolved ? `Ergebnis: ${market.resolution === 'yes' ? 'Höher ↑' : 'Tiefer ↓'}` : 'Markt läuft ab…'}</div>
                    {market.resolved && market.start_price && market.end_price && (<div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>${market.start_price.toFixed(2)} → ${market.end_price.toFixed(2)}</div>)}
                  </div>
                </div>
                {nextLiveMarket && (<button onClick={() => router.push(`/markets/${nextLiveMarket.id}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />Zum Live-Markt →</button>)}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 180px', gap: 16, padding: '10px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Ausgang</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Wahrsch.</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Handeln</div>
                </div>
                <FinanceOutcomeRow label="↑ Höher" sublabel={`als $${market.start_price?.toFixed(2)}`} prob={prob} isWinner={market.resolved && market.resolution === 'yes'} isResolved={!!market.resolved} isActive={direction === 'yes'} color="#16a34a" onBuy={() => { setDirection('yes'); setTradeTab('kaufen') }} onSell={() => { setDirection('yes'); setTradeTab('verkaufen') }} hasPosition={sharesYes > 0} shares={sharesYes} />
                <FinanceOutcomeRow label="↓ Tiefer" sublabel={`als $${market.start_price?.toFixed(2)}`} prob={100 - prob} isWinner={market.resolved && market.resolution === 'no'} isResolved={!!market.resolved} isActive={direction === 'no'} color="#dc2626" onBuy={() => { setDirection('no'); setTradeTab('kaufen') }} onSell={() => { setDirection('no'); setTradeTab('verkaufen') }} hasPosition={sharesNo > 0} shares={sharesNo} />
                <div style={{ padding: '10px 20px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}><LivePositionsBar trades={trades} isKrypto={false} /></div>
              </div>
              <div className="card" style={{ position: 'sticky', top: 'calc(var(--nav-height) + 16px)', padding: 0, overflow: 'hidden' }}>
                {financeIsEnded ? (
                  <div style={{ padding: '24px 16px' }}>
                    <div style={{ textAlign: 'center', marginBottom: 16 }}>
                      <div style={{ fontSize: 28, marginBottom: 4 }}>{userWon ? '🎉' : hasPosition ? '😔' : '✓'}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{userWon ? 'Gewonnen!' : hasPosition ? 'Verloren' : 'Markt beendet'}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Ergebnis: <strong style={{ color: market.resolution === 'yes' ? '#16a34a' : '#dc2626', fontSize: 15 }}>{market.resolution === 'yes' ? '↑ Höher' : '↓ Tiefer'}</strong></div>
                    </div>
                    {hasPosition && (<div style={{ padding: '14px', borderRadius: 10, textAlign: 'center', marginBottom: 14, background: userWon ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${userWon ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}` }}>{userWon ? (<><div style={{ fontSize: 12, color: '#16a34a', marginBottom: 4 }}>Auszahlung erfolgt automatisch</div><div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a' }}>+{Math.round(market.resolution === 'yes' ? sharesYes : sharesNo)} ₫</div></>) : (<div style={{ fontSize: 13, color: '#dc2626' }}>Leider verloren — nächsten Markt versuchen!</div>)}</div>)}
                    {nextLiveMarket && (<button onClick={() => router.push(`/markets/${nextLiveMarket.id}`)} style={{ width: '100%', padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />Zum Live-Markt →</button>)}
                  </div>
                ) : !user ? (
                  <div style={{ textAlign: 'center', padding: '24px 16px' }}><div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>Anmelden um zu handeln</div><button className="submit-btn yes" onClick={() => router.push('/')}>Zur Anmeldung</button></div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
                      <div style={{ display: 'flex' }}>
                        {(['kaufen', 'verkaufen'] as TradeTab[]).map(t => (<button key={t} onClick={() => { setTradeTab(t); setBetError(''); setBetSuccess('') }} style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: 'transparent', color: tradeTab === t ? 'var(--text)' : 'var(--text-muted)', borderBottom: tradeTab === t ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1 }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>))}
                      </div>
                    </div>
                    <div style={{ padding: 16 }}>
                      {tradeTab === 'kaufen' && (<>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                          {(['yes', 'no'] as const).map(d => (<button key={d} onClick={() => setDirection(d)} style={{ padding: '12px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, background: direction === d ? (d === 'yes' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)') : 'var(--surface)', color: direction === d ? (d === 'yes' ? '#16a34a' : '#dc2626') : 'var(--text-muted)', outline: direction === d ? `2px solid ${d === 'yes' ? '#16a34a' : '#dc2626'}` : '2px solid transparent' }}>{d === 'yes' ? `↑ Höher · ${prob}¢` : `↓ Tiefer · ${100 - prob}¢`}</button>))}
                        </div>
                        <SpendInput spendRaw={spendRaw} setSpendRaw={setSpendRaw} spend={spend} setSpend={setSpend} userBalance={user.balance} />
                        <div style={{ background: 'rgba(22,163,74,0.07)', borderRadius: 10, padding: '14px', marginBottom: 14, textAlign: 'center', border: '1px solid rgba(22,163,74,0.2)' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Auszahlung wenn {direction === 'yes' ? '↑ Höher' : '↓ Tiefer'} eintritt</div><div style={{ fontSize: 32, fontWeight: 800, color: '#16a34a', letterSpacing: '-0.5px' }}>{payout} ₫</div></div>
                      </>)}
                      {tradeTab === 'verkaufen' && (<>{!hasPosition ? (<div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'var(--text-muted)' }}>Du hast keine Anteile in diesem Markt.</div>) : (<><div style={{ background: 'var(--surface)', borderRadius: 8, padding: '12px', marginBottom: 16, fontSize: 13 }}><div style={{ color: 'var(--text-muted)', marginBottom: 4, fontSize: 12 }}>Deine Position</div>{sharesYes > 0 && <div style={{ fontWeight: 700, color: '#16a34a' }}>↑ Höher · {Math.round(sharesYes)} Anteile</div>}{sharesNo > 0 && <div style={{ fontWeight: 700, color: '#dc2626' }}>↓ Tiefer · {Math.round(sharesNo)} Anteile</div>}</div><div style={{ background: 'rgba(22,163,74,0.07)', borderRadius: 10, padding: '14px', marginBottom: 14, textAlign: 'center', border: '1px solid rgba(22,163,74,0.2)' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Du erhältst jetzt</div><div style={{ fontSize: 32, fontWeight: 800, color: '#16a34a', letterSpacing: '-0.5px' }}>{Math.round(returnOnSell)} ₫</div><div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 4 }}>alle Anteile verkaufen</div></div></>)}</>)}
                      {betError   && <div className="alert alert-error"   style={{ marginBottom: 10 }}>{betError}</div>}
                      {betSuccess  && <div className="alert alert-success" style={{ marginBottom: 10 }}>{betSuccess}</div>}
                      {tradeTab === 'kaufen' ? (<button className={`submit-btn ${direction === 'yes' ? 'yes' : 'no'}`} onClick={handleKaufen} disabled={betLoading || spend <= 0} style={{ width: '100%' }}>{betLoading ? 'Wird ausgeführt…' : `${direction === 'yes' ? '↑ Höher' : '↓ Tiefer'} kaufen · ${spend} ₫`}</button>) : (<button className="submit-btn no" onClick={handleVerkaufen} disabled={betLoading || !hasPosition} style={{ width: '100%' }}>{betLoading ? 'Wird verkauft…' : `Verkaufen · ${Math.round(returnOnSell)} ₫`}</button>)}
                      <div style={{ fontSize: 11, color: 'var(--text-subtle)', textAlign: 'center', marginTop: 8 }}>Guthaben: {user.balance.toLocaleString('de')} ₫</div>
                    </div>
                  </>
                )}
              </div>
            </div>
            {trades.filter(t => t.shares > 0).length > 0 && (
              <div className="card" style={{ marginTop: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Letzte Trades</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...trades].filter(t => t.shares > 0).reverse().slice(0, 10).map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: t.type.includes('yes') ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{t.type.includes('yes') ? '↑ Höher' : '↓ Tiefer'}</span>
                      <span style={{ color: 'var(--text)' }}>{Math.round(Math.abs(t.cost))} ₫</span>
                      <span style={{ color: 'var(--text-subtle)' }}>{new Date(t.created_at).toLocaleDateString('de', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── KRYPTO ── */}
        {isKrypto && showEndedBanner && (
          <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 14, background: market.resolved ? (market.resolution === 'yes' ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)') : 'rgba(245,158,11,0.12)', border: `1px solid ${market.resolved ? (market.resolution === 'yes' ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)') : 'rgba(245,158,11,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>{market.resolved ? (market.resolution === 'yes' ? '↑' : '↓') : '⏳'}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: market.resolved ? (market.resolution === 'yes' ? '#16a34a' : '#dc2626') : '#b45309' }}>{market.resolved ? `Ergebnis: ${market.resolution === 'yes' ? 'Up ↑' : 'Down ↓'}` : 'Markt läuft ab — Auflösung folgt…'}</div>
                {market.resolved && market.start_price && market.end_price && (<div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{market.short_label ?? market.coin}: ${market.start_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → ${market.end_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>)}
              </div>
            </div>
            {nextLiveMarket && (<button onClick={() => router.push(`/markets/${nextLiveMarket.id}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />Zum Live-Markt →</button>)}
          </div>
        )}
        {isKrypto && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, background: COIN_COLORS[market.coin ?? ''] ?? '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{market.short_label?.charAt(0) ?? market.coin?.charAt(0) ?? '₿'}</span>
                <div><div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{autoMarketTitle}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{market.resolved ? 'Markt beendet' : market.group_title ?? ''}</div></div>
              </div>
              {!market.resolved && (<div style={{ textAlign: 'right', flexShrink: 0 }}><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Verbleibend</div><CountdownDisplay targetMs={closesAtMs} redThresholdMs={30000} /></div>)}
            </div>
            <div style={{ display: 'flex', gap: 40, marginBottom: 16 }}>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Startpreis</div><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>${market.start_price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}</div></div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {market.resolved ? 'Endpreis' : 'Aktueller Preis'}
                  {market.resolved && endDelta !== null && (<span style={{ color: endDelta >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700, fontSize: 12 }}>{endDelta >= 0 ? '▲' : '▼'} ${Math.abs(endDelta).toFixed(2)}</span>)}
                  {!market.resolved && delta !== null && (<span style={{ color: isUp ? '#16a34a' : '#dc2626', fontWeight: 700, fontSize: 12 }}>{isUp ? '▲' : '▼'} ${Math.abs(delta).toFixed(2)}</span>)}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: market.resolved ? 'var(--text)' : '#f97316' }}>{market.resolved ? `$${market.end_price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}` : livePrice ? `$${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Lädt…'}</div>
              </div>
            </div>
            {!market.resolved && <LivePositionsBar trades={trades} isKrypto={true} />}
            <div style={{ position: 'relative', width: '100%', height: 240 }}>
              <canvas ref={cryptoCanvasRef} width={860} height={240} style={{ width: '100%', height: '100%', display: 'block' }} />
              {priceHistory.length < 1 && !market.resolved && (<div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Chart wird aufgebaut…</div>)}
            </div>
          </div>
        )}

        {/* ── WETTER & NORMAL & FORMULA 1 ── */}
        {!isKrypto && !isSoccer && !isFinance && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {isFormula1 && (<span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>🏎 Formel 1</span>)}
                {isWeather && (<span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: 'rgba(14,165,233,0.1)', color: '#0ea5e9' }}>🌤 Wetter</span>)}
                {!isFormula1 && !isWeather && market.category && <span className={`cat-badge ${catClass}`}>{market.category}</span>}
                {market.group_title && !isWeather && (<span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{market.group_title}</span>)}
                {market.resolved && (
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: market.resolution === 'yes' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)', color: market.resolution === 'yes' ? '#16a34a' : '#dc2626' }}>
                    Aufgelöst: {market.resolution === 'yes' ? 'Ja' : 'Nein'}
                  </span>
                )}
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, marginBottom: 8 }}>{market.question}</h1>
              {isWeather && market.start_price !== null && market.start_price !== undefined && (
                <div style={{ display: 'flex', gap: 24, padding: '12px 16px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', marginTop: 12, flexWrap: 'wrap' }}>
                  <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Heutiges Maximum</div><div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{market.start_price}°C</div></div>
                  {market.end_price !== null && market.end_price !== undefined && (
                    <><div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} /><div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Morgens Maximum</div><div style={{ fontSize: 20, fontWeight: 700, color: market.end_price > market.start_price ? '#16a34a' : '#dc2626' }}>{market.end_price}°C {market.end_price > market.start_price ? '▲' : '▼'}</div></div></>
                  )}
                  <div style={{ marginLeft: 'auto' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Datenquelle</div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Open-Meteo</div></div>
                </div>
              )}
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              {!market.resolved && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{isFormula1 || isWeather ? 'Markt schließt' : 'Schließt in'}</div>
                  <CountdownDisplay targetMs={closesAtMs} redThresholdMs={isWeather ? 3600000 : 3600000} />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 36, fontWeight: 700, color: isLow ? 'var(--no)' : 'var(--yes)' }}>{prob}%</span>
                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Wahrscheinlichkeit Ja</span>
              </div>
              <div className="prob-bar" style={{ height: 8, marginBottom: 12 }}>
                <div className={`prob-bar-fill ${isLow ? 'low' : ''}`} style={{ width: `${prob}%` }} />
              </div>
              <div style={{ display: 'flex', gap: 20, fontSize: 13, color: 'var(--text-muted)' }}>
                <span>Volumen: <strong style={{ color: 'var(--text)' }}>{Math.round(market.q_yes + market.q_no).toLocaleString('de')} ₫</strong></span>
                <span>Trades: <strong style={{ color: 'var(--text)' }}>{trades.filter(t => t.shares > 0).length}</strong></span>
              </div>
              {!market.resolved && <LivePositionsBar trades={trades} isKrypto={false} />}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
              <div className="card">
                {!isFormula1 && !isWeather && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Preisverlauf</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(['7T', '1M', 'Gesamt'] as Tab[]).map(t => (<button key={t} onClick={() => setActiveTab(t)} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: activeTab === t ? 'var(--accent)' : 'var(--surface)', color: activeTab === t ? '#fff' : 'var(--text-muted)', fontWeight: activeTab === t ? 600 : 400 }}>{t}</button>))}
                      </div>
                    </div>
                    {tradeHistory.length === 0 ? <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>Chart erscheint nach der ersten Wette.</div> : <div style={{ height: 200, position: 'relative' }}><canvas ref={chartRef} /></div>}
                    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-subtle)' }}>Volumen: {Math.round(market.q_yes + market.q_no).toLocaleString('de')} ₫ · {trades.filter(t => t.shares > 0).length} Trades</div>
                  </>
                )}
                {(isFormula1 || isWeather) && market.description && (<MarketRules description={market.description} />)}
                {trades.filter(t => t.shares > 0).length > 0 && (
                  <div style={{ marginTop: (isFormula1 || isWeather) ? 0 : 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Letzte Trades</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[...trades].filter(t => t.shares > 0).reverse().slice(0, 10).map(t => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ color: t.type.includes('yes') ? 'var(--yes)' : 'var(--no)', fontWeight: 600 }}>{t.type.includes('yes') ? 'Ja' : 'Nein'}</span>
                          <span style={{ color: 'var(--text)' }}>{Math.round(Math.abs(t.cost))} ₫</span>
                          <span style={{ color: 'var(--text-subtle)' }}>{new Date(t.created_at).toLocaleDateString('de', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {renderTradePanel()}
            </div>
          </>
        )}

        {!isSoccer && !isFinance && !isFormula1 && !isWeather && trades.filter(t => t.shares > 0).length > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Letzte Trades</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...trades].filter(t => t.shares > 0).reverse().slice(0, 10).map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: t.type.includes('yes') ? 'var(--yes)' : 'var(--no)', fontWeight: 600 }}>{t.type.includes('yes') ? 'Up' : 'Down'}</span>
                  <span style={{ color: 'var(--text)' }}>{Math.round(Math.abs(t.cost))} ₫</span>
                  <span style={{ color: 'var(--text-subtle)' }}>{new Date(t.created_at).toLocaleDateString('de', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isFormula1 && !isWeather && market.description && <MarketRules description={market.description} />}
        <CommentsSection marketId={marketId} />
      </div>

      <style>{`
        @keyframes slideInRight { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </>
  )
}
