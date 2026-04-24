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

async function dbWrite(method: 'POST' | 'PATCH' | 'DELETE', table: string, query: string, body?: object) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query ? '?' + query : ''}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res
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

  const nowMs = Date.now()
  if (nowMs < marketEndMs) {
    const nowX = Math.min(xScale(nowMs), W - padR)
    ctx.fillStyle = 'rgba(0,0,0,0.02)'
    ctx.fillRect(nowX, padT, W - padR - nowX, H - padT - padB)
  }

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
  if (filteredHistory.length > 1) {
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
    ctx.fillText(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`, xScale(ms), H - padB + 16)
  }
}

const CAT_CLASS: Record<string, string> = {
  Politik: 'cat-politik', Sport: 'cat-sport', Krypto: 'cat-krypto',
  Entertainment: 'cat-entertainment', Wirtschaft: 'cat-wirtschaft',
}
const COIN_COLORS: Record<string, string> = { BTC: '#f59e0b', ETH: '#6366f1', SOL: '#9945ff', XRP: '#00aae4' }

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

  const [tradeTab, setTradeTab]     = useState<TradeTab>('kaufen')
  const [orderType, setOrderType]   = useState<OrderType>('markt')
  const [direction, setDirection]   = useState<'yes' | 'no'>('yes')
  const [spend, setSpend]           = useState(100)
  const [limitPrice, setLimitPrice] = useState(50)
  const [betLoading, setBetLoading] = useState(false)
  const [betError, setBetError]     = useState('')
  const [betSuccess, setBetSuccess] = useState('')

  const [activeTab, setActiveTab]       = useState<Tab>('7T')
  const chartRef                        = useRef<HTMLCanvasElement>(null)
  const chartInstance                   = useRef<unknown>(null)
  const [livePrice, setLivePrice]       = useState<number | null>(null)
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([])
  const [countdown, setCountdown]       = useState('')
  const cryptoCanvasRef                 = useRef<HTMLCanvasElement>(null)
  const priceHistoryRef                 = useRef<PricePoint[]>([])
  const lastRealPrice                   = useRef<number | null>(null)
  const marketRef                       = useRef<Market | null>(null)
  const liveMarketPollRef               = useRef<ReturnType<typeof setInterval> | null>(null)
  const positionRef                     = useRef<Position | null>(null)

  // Toast-State
  const [resultToast, setResultToast]   = useState<ResultToast | null>(null)
  const toastShownRef                   = useRef(false)

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
    setPosition(pos)
    positionRef.current = pos
  }, [marketId])

  const loadLiveMarkets = useCallback(async () => {
    const data = await dbGet('markets', `is_auto=eq.true&resolved=eq.false&select=*&order=closes_at.asc`)
    setLiveMarkets(data ?? [])
  }, [])

  // Toast feuern sobald Markt aufgelöst wird — einmalig
  useEffect(() => {
    if (!market?.resolved || toastShownRef.current) return
    if (!market.is_auto) return // nur für Krypto-Märkte
    toastShownRef.current = true

    const pos       = positionRef.current
    const sharesYes = pos?.shares_yes ?? 0
    const sharesNo  = pos?.shares_no  ?? 0
    const hasPos    = sharesYes > 0 || sharesNo > 0
    const won       = hasPos && (
      (market.resolution === 'yes' && sharesYes > 0) ||
      (market.resolution === 'no'  && sharesNo  > 0)
    )
    const amount = won ? Math.round(market.resolution === 'yes' ? sharesYes : sharesNo) : 0

    // nextLiveMarket aus liveMarkets holen
    const next = liveMarkets.find(m => m.coin === market.coin && m.id !== marketId)

    setResultToast({
      won,
      amount,
      resolution: market.resolution ?? '',
      coin: market.coin,
      nextMarketId: next?.id,
    })

    // Balance neu laden
    if (user?.id) {
      dbGet('users', `id=eq.${user.id}&select=balance`).then(d => {
        if (d?.[0]) setUser(prev => prev ? { ...prev, balance: d[0].balance } : prev)
      })
    }
  }, [market?.resolved, market?.resolution, market?.is_auto, market?.coin, liveMarkets, marketId, user?.id])

  // nextMarketId im Toast aktualisieren sobald liveMarkets nachlädt
  useEffect(() => {
    if (!resultToast || resultToast.nextMarketId) return
    const next = liveMarkets.find(m => m.coin === market?.coin && m.id !== marketId)
    if (next) setResultToast(prev => prev ? { ...prev, nextMarketId: next.id } : prev)
  }, [liveMarkets, resultToast, market?.coin, marketId])

  useEffect(() => {
    loadMarket(); loadTrades(); loadLiveMarkets()

    let interval: ReturnType<typeof setInterval>

    const startInterval = (ms: number) => {
      clearInterval(interval)
      interval = setInterval(() => {
        loadMarket(); loadTrades(); loadLiveMarkets()
      }, ms)
    }

    startInterval(10000)

    const watchdog = setInterval(() => {
      const m = marketRef.current
      if (!m) return
      const diff = parseUTC(m.closes_at).getTime() - Date.now()
      if (m.resolved) {
        startInterval(10000)
        if (!liveMarketPollRef.current) {
          liveMarketPollRef.current = setInterval(() => { loadLiveMarkets() }, 1000)
        }
      } else if (diff <= 0) {
        startInterval(2000)
        if (!liveMarketPollRef.current) {
          liveMarketPollRef.current = setInterval(() => { loadLiveMarkets(); loadMarket() }, 1000)
        }
      } else if (diff <= 30000) {
        startInterval(5000)
      } else {
        startInterval(10000)
      }
    }, 1000)

    return () => {
      clearInterval(interval)
      clearInterval(watchdog)
      if (liveMarketPollRef.current) clearInterval(liveMarketPollRef.current)
    }
  }, [loadMarket, loadTrades, loadLiveMarkets])

  useEffect(() => {
    if (!market?.resolved) return
    const coin = market.coin
    const found = liveMarkets.find(m => m.coin === coin && m.id !== marketId)
    if (found && liveMarketPollRef.current) {
      clearInterval(liveMarketPollRef.current)
      liveMarketPollRef.current = null
    }
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
    const coin        = market.coin
    const marketEndMs = parseUTC(market.closes_at).getTime()
    const fetchReal = async () => {
      if (Date.now() > marketEndMs) return
      const price = await fetchCoinbasePrice(coin)
      if (price === null) return
      lastRealPrice.current = price
      const point: PricePoint = { t: Math.min(Date.now(), marketEndMs), price }
      priceHistoryRef.current = [...priceHistoryRef.current, point].slice(-300)
      setPriceHistory([...priceHistoryRef.current])
      setLivePrice(price)
    }
    fetchReal()
    const fetchInterval  = setInterval(() => {
      if (Date.now() > marketEndMs) { clearInterval(fetchInterval); clearInterval(interpInterval); return }
      fetchReal()
    }, 10000)
    const interpInterval = setInterval(() => {
      if (Date.now() > marketEndMs) return
      if (lastRealPrice.current === null) return
      const hist   = priceHistoryRef.current
      const last   = hist.length > 0 ? hist[hist.length - 1].price : lastRealPrice.current
      const jitter = last * 0.00008 * (Math.random() * 2 - 1)
      const point: PricePoint = { t: Math.min(Date.now(), marketEndMs), price: last + jitter }
      priceHistoryRef.current = [...priceHistoryRef.current, point].slice(-300)
      setPriceHistory([...priceHistoryRef.current])
      setLivePrice(last + jitter)
    }, 1000)
    return () => { clearInterval(fetchInterval); clearInterval(interpInterval) }
  }, [market?.is_auto, market?.coin, market?.resolved, market?.closes_at])

  useEffect(() => {
    if (!market?.is_auto || !cryptoCanvasRef.current || !market?.start_price || !market?.closes_at) return
    const marketEndMs   = parseUTC(market.closes_at).getTime()
    const marketStartMs = marketEndMs - 3 * 60 * 1000
    drawCryptoChart(cryptoCanvasRef.current, priceHistory, market.start_price, marketStartMs, marketEndMs)
  }, [priceHistory, market?.is_auto, market?.start_price, market?.closes_at, market?.resolved])

  useEffect(() => {
    if (!market?.closes_at) return
    const closesAt = parseUTC(market.closes_at)
    const tick = () => {
      const diff = closesAt.getTime() - Date.now()
      if (diff <= 0) { setCountdown('00:00'); return }
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [market?.closes_at])

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
      const now   = new Date()
      const since = activeTab === '7T' ? new Date(now.getTime() - 7 * 24 * 3600 * 1000)
        : activeTab === '1M' ? new Date(now.getTime() - 30 * 24 * 3600 * 1000) : new Date(0)
      const pts        = tradeHistory.filter(p => new Date(p.t) >= since)
      const dataPoints = pts.length > 0 ? pts : tradeHistory.slice(-10)
      const isDark     = document.documentElement.getAttribute('data-theme') === 'dark'
      const gridColor  = isDark ? '#2a2d3a' : '#e8eaef'
      const tickColor  = isDark ? '#94a3b8' : '#9ca3af'
      if (chartInstance.current) (chartInstance.current as { destroy: () => void }).destroy()
      chartInstance.current = new Chart(chartRef.current!, {
        type: 'line',
        data: {
          labels: dataPoints.map(p => {
            const d = new Date(p.t)
            return activeTab === 'Gesamt' ? d.toLocaleDateString('de', { month: 'short', day: 'numeric' }) : d.toLocaleDateString('de', { day: '2-digit', month: '2-digit' })
          }),
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
    if (spend <= 0) { setBetError('Ungültiger Betrag.'); return }
    if (user.balance < spend) { setBetError('Nicht genug Guthaben.'); return }
    setBetLoading(true); setBetError('')
    if (orderType === 'limit') {
      setBetSuccess(`Limit-Order bei ${limitPrice}¢ platziert.`)
      setBetLoading(false); setTimeout(() => setBetSuccess(''), 4000); return
    }
    const probBefore = calcProb(market.q_yes, market.q_no, market.b) / 100
    const shares     = lmsrSharesForSpend(market.q_yes, market.q_no, market.b, direction, spend)
    const newQYes    = direction === 'yes' ? market.q_yes + shares : market.q_yes
    const newQNo     = direction === 'no'  ? market.q_no  + shares : market.q_no
    const probAfter  = calcProb(newQYes, newQNo, market.b) / 100
    const tradeRes = await dbWrite('POST', 'trades', '', {
      market_id: marketId, user_id: user.id,
      type: direction === 'yes' ? 'buy_yes' : 'buy_no',
      shares, cost: spend, price_before: probBefore, price_after: probAfter,
    })
    if (!tradeRes.ok) { setBetError('Fehler beim Platzieren.'); setBetLoading(false); return }
    await dbWrite('PATCH', 'markets', `id=eq.${marketId}`, { q_yes: newQYes, q_no: newQNo })
    await dbWrite('PATCH', 'users', `id=eq.${user.id}`, { balance: Math.round(user.balance - spend) })
    const existingPos = await dbGet('positions', `user_id=eq.${user.id}&market_id=eq.${marketId}&select=*`)
    if (existingPos?.[0]) {
      const pos = existingPos[0]
      await dbWrite('PATCH', 'positions', `user_id=eq.${user.id}&market_id=eq.${marketId}`, {
        shares_yes: direction === 'yes' ? (pos.shares_yes ?? 0) + shares : (pos.shares_yes ?? 0),
        shares_no:  direction === 'no'  ? (pos.shares_no  ?? 0) + shares : (pos.shares_no  ?? 0),
        updated_at: new Date().toISOString(),
      })
    } else {
      await dbWrite('POST', 'positions', '', {
        user_id: user.id, market_id: marketId,
        shares_yes: direction === 'yes' ? shares : 0,
        shares_no:  direction === 'no'  ? shares : 0,
        updated_at: new Date().toISOString(),
      })
    }
    setUser({ ...user, balance: Math.round(user.balance - spend) })
    setBetSuccess('Wette platziert ✓')
    setBetLoading(false)
    loadMarket(); loadTrades(); loadPosition(user.id)
    setTimeout(() => setBetSuccess(''), 2500)
  }

  async function handleVerkaufen() {
    if (!user || !market || !position) return
    const sharesYes  = position.shares_yes ?? 0
    const sharesNo   = position.shares_no  ?? 0
    const sellSide   = sharesYes >= sharesNo ? 'yes' : 'no'
    const sellShares = sellSide === 'yes' ? sharesYes : sharesNo
    if (sellShares <= 0) { setBetError('Keine Anteile.'); return }
    setBetLoading(true); setBetError('')
    const probBefore = calcProb(market.q_yes, market.q_no, market.b) / 100
    const returnAmt  = lmsrSellReturn(market.q_yes, market.q_no, market.b, sellSide, sellShares)
    const newQYes    = sellSide === 'yes' ? Math.max(0, market.q_yes - sellShares) : market.q_yes
    const newQNo     = sellSide === 'no'  ? Math.max(0, market.q_no  - sellShares) : market.q_no
    const probAfter  = calcProb(newQYes, newQNo, market.b) / 100
    await dbWrite('POST', 'trades', '', {
      market_id: marketId, user_id: user.id,
      type: sellSide === 'yes' ? 'sell_yes' : 'sell_no',
      shares: sellShares, cost: -returnAmt, price_before: probBefore, price_after: probAfter,
    })
    await dbWrite('PATCH', 'markets', `id=eq.${marketId}`, { q_yes: newQYes, q_no: newQNo })
    await dbWrite('PATCH', 'users', `id=eq.${user.id}`, { balance: Math.round(user.balance + returnAmt) })
    await dbWrite('DELETE', 'positions', `user_id=eq.${user.id}&market_id=eq.${marketId}`)
    setUser({ ...user, balance: Math.round(user.balance + returnAmt) })
    setBetSuccess(`${Math.round(returnAmt)} ₫ erhalten ✓`)
    setBetLoading(false)
    loadMarket(); loadTrades(); loadPosition(user.id)
    setTimeout(() => setBetSuccess(''), 2500)
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--text-muted)', fontSize: 14 }}>Markt wird geladen…</div>
  if (!market) return (
    <div style={{ padding: 32 }}>
      <div style={{ color: 'var(--no)', fontSize: 14, marginBottom: 16 }}>Markt nicht gefunden.</div>
      <button className="nav-pill" onClick={() => router.push('/')}>← Zurück</button>
    </div>
  )

  const prob         = calcProb(market.q_yes, market.q_no, market.b)
  const isLow        = prob < 50
  const catClass     = CAT_CLASS[market.category ?? ''] ?? ''
  const payout       = Math.round(lmsrSharesForSpend(market.q_yes, market.q_no, market.b, direction, spend))
  const sharesYes    = position?.shares_yes ?? 0
  const sharesNo     = position?.shares_no  ?? 0
  const hasPosition  = sharesYes > 0 || sharesNo > 0
  const sellSide     = sharesYes >= sharesNo ? 'yes' : 'no'
  const sellShares   = sellSide === 'yes' ? sharesYes : sharesNo
  const returnOnSell = hasPosition ? lmsrSellReturn(market.q_yes, market.q_no, market.b, sellSide, sellShares) : 0
  const isKrypto     = !!market.is_auto
  const closesAt     = parseUTC(market.closes_at)
  const delta        = livePrice && market.start_price ? livePrice - market.start_price : null
  const endDelta     = market.end_price && market.start_price ? market.end_price - market.start_price : null
  const isUp         = delta !== null ? delta >= 0 : (endDelta !== null ? endDelta >= 0 : true)
  const countdownRed = countdown === '00:00' || (countdown !== '' && parseInt(countdown.split(':')[0]) === 0 && parseInt(countdown.split(':')[1]) <= 30)
  const nextLiveMarket   = liveMarkets.find(m => m.coin === market.coin && m.id !== marketId)
  const otherLiveMarkets = liveMarkets.filter(m => m.coin !== market.coin).slice(0, 4)
  const userWon = market.resolved && hasPosition &&
    ((market.resolution === 'yes' && sharesYes > 0) || (market.resolution === 'no' && sharesNo > 0))
  const showEndedBanner = market.resolved || countdown === '00:00'

  return (
    <>
      {/* ── Ergebnis-Toast ── */}
      {resultToast && (
        <div style={{
          position: 'fixed', top: 80, right: 16, zIndex: 9999,
          background: '#fff',
          border: `1px solid ${resultToast.won ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`,
          borderLeft: `4px solid ${resultToast.won ? '#16a34a' : '#dc2626'}`,
          borderRadius: 14, padding: '16px 18px', minWidth: 280, maxWidth: 340,
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          animation: 'slideInRight 0.35s cubic-bezier(.21,1.02,.73,1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {resultToast.coin && (
                <span style={{ width: 28, height: 28, borderRadius: 7, background: COIN_COLORS[resultToast.coin] ?? '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>
                  {resultToast.coin.charAt(0)}
                </span>
              )}
              <span style={{ fontSize: 14, fontWeight: 700, color: resultToast.won ? '#16a34a' : '#dc2626' }}>
                {resultToast.won ? '🎉 Gewonnen!' : '😔 Verloren'}
              </span>
            </div>
            <button onClick={() => setResultToast(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#9ca3af', padding: 0, lineHeight: 1 }}>×</button>
          </div>

          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
            {resultToast.coin} · Ergebnis: <strong style={{ color: resultToast.resolution === 'yes' ? '#16a34a' : '#dc2626' }}>
              {resultToast.resolution === 'yes' ? 'Up ↑' : 'Down ↓'}
            </strong>
          </div>

          {resultToast.won && resultToast.amount > 0 && (
            <div style={{ fontSize: 30, fontWeight: 800, color: '#16a34a', letterSpacing: '-0.5px', marginBottom: 12, lineHeight: 1 }}>
              +{resultToast.amount.toLocaleString('de')} ₫
            </div>
          )}

          {resultToast.nextMarketId ? (
            <button onClick={() => { setResultToast(null); router.push(`/markets/${resultToast.nextMarketId}`) }}
              style={{ width: '100%', padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
              Zum Live-Markt →
            </button>
          ) : (
            <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>Nächster Markt wird erstellt…</div>
          )}
        </div>
      )}

      <nav className="nav">
        <div className="nav-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-weiss.png" alt="Möbius" className="nav-logo" onClick={() => router.push('/')} style={{ cursor: 'pointer' }} />
          <button className="nav-pill" onClick={() => router.push('/')} style={{ fontSize: 13 }}>← Alle Märkte</button>
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

        {/* Ergebnis-Banner */}
        {isKrypto && showEndedBanner && (
          <div style={{
            marginBottom: 20, padding: '16px 20px', borderRadius: 14,
            background: market.resolved
              ? (market.resolution === 'yes' ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)')
              : 'rgba(245,158,11,0.12)',
            border: `1px solid ${market.resolved
              ? (market.resolution === 'yes' ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)')
              : 'rgba(245,158,11,0.3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 28 }}>{market.resolved ? (market.resolution === 'yes' ? '↑' : '↓') : '⏳'}</span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: market.resolved ? (market.resolution === 'yes' ? '#16a34a' : '#dc2626') : '#b45309' }}>
                  {market.resolved ? `Ergebnis: ${market.resolution === 'yes' ? 'Up ↑' : 'Down ↓'}` : 'Markt läuft ab — Auflösung folgt…'}
                </div>
                {market.resolved && market.start_price && market.end_price && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    {market.coin}: ${market.start_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → ${market.end_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            </div>
            {nextLiveMarket ? (
              <button onClick={() => router.push(`/markets/${nextLiveMarket.id}`)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
                Zum Live-Markt →
              </button>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                Nächster Markt wird erstellt…
              </div>
            )}
          </div>
        )}

        {/* Krypto Header */}
        {isKrypto && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, background: COIN_COLORS[market.coin ?? ''] ?? '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {market.coin?.charAt(0) ?? '₿'}
                </span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{market.coin} Up or Down – 3 Minuten</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {market.resolved ? 'Markt beendet' : `Schließt um ${closesAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {!market.resolved && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Verbleibend</div>
                    <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-2px', fontVariantNumeric: 'tabular-nums', color: countdownRed ? '#dc2626' : 'var(--text)', lineHeight: 1 }}>
                      {countdown || '--:--'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 40, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Zielpreis</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                  ${market.start_price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {market.resolved ? 'Endpreis' : 'Aktueller Preis'}
                  {market.resolved && endDelta !== null && (
                    <span style={{ color: endDelta >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700, fontSize: 12 }}>
                      {endDelta >= 0 ? '▲' : '▼'} ${Math.abs(endDelta).toFixed(2)}
                    </span>
                  )}
                  {!market.resolved && delta !== null && (
                    <span style={{ color: isUp ? '#16a34a' : '#dc2626', fontWeight: 700, fontSize: 12 }}>
                      {isUp ? '▲' : '▼'} ${Math.abs(delta).toFixed(2)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: market.resolved ? 'var(--text)' : '#f97316' }}>
                  {market.resolved
                    ? `$${market.end_price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}`
                    : livePrice ? `$${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Lädt…'}
                </div>
              </div>
            </div>

            <div style={{ position: 'relative', width: '100%', height: 240 }}>
              <canvas ref={cryptoCanvasRef} width={860} height={240} style={{ width: '100%', height: '100%', display: 'block' }} />
              {priceHistory.length < 2 && !market.resolved && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Chart wird aufgebaut…
                </div>
              )}
            </div>
          </div>
        )}

        {/* Normaler Header */}
        {!isKrypto && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {market.category && <span className={`cat-badge ${catClass}`}>{market.category}</span>}
                {market.resolved && (
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: market.resolution === 'yes' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)', color: market.resolution === 'yes' ? '#16a34a' : '#dc2626' }}>
                    Aufgelöst: {market.resolution === 'yes' ? 'Ja' : 'Nein'}
                  </span>
                )}
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35, marginBottom: 8 }}>{market.question}</h1>
              {market.description && <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>{market.description}</p>}
            </div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 36, fontWeight: 700, color: isLow ? 'var(--no)' : 'var(--yes)' }}>{prob}%</span>
                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Wahrscheinlichkeit Ja</span>
              </div>
              <div className="prob-bar" style={{ height: 8, marginBottom: 0 }}>
                <div className={`prob-bar-fill ${isLow ? 'low' : ''}`} style={{ width: `${prob}%` }} />
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

          {!isKrypto && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Preisverlauf</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['7T', '1M', 'Gesamt'] as Tab[]).map(t => (
                    <button key={t} onClick={() => setActiveTab(t)} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: activeTab === t ? 'var(--accent)' : 'var(--surface)', color: activeTab === t ? '#fff' : 'var(--text-muted)', fontWeight: activeTab === t ? 600 : 400 }}>{t}</button>
                  ))}
                </div>
              </div>
              {tradeHistory.length === 0
                ? <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>Chart erscheint nach der ersten Wette.</div>
                : <div style={{ height: 200, position: 'relative' }}><canvas ref={chartRef} /></div>}
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-subtle)' }}>
                Volumen: {Math.round(market.q_yes + market.q_no).toLocaleString('de')} ₫ · {trades.filter(t => t.shares > 0).length} Trades
              </div>
            </div>
          )}

          {isKrypto && market.resolved && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: market.resolution === 'yes' ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 36 }}>
                  {market.resolution === 'yes' ? '✓' : '✗'}
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 8, color: market.resolution === 'yes' ? '#16a34a' : '#dc2626' }}>
                  Ergebnis: {market.resolution === 'yes' ? 'Up ↑' : 'Down ↓'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                  {market.coin}: ${market.start_price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → ${market.end_price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {nextLiveMarket && (
                  <button onClick={() => router.push(`/markets/${nextLiveMarket.id}`)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 20, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
                    Zum Live-Markt →
                  </button>
                )}
              </div>
              {otherLiveMarkets.length > 0 && (
                <div className="card">
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Weitere Live-Märkte</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {otherLiveMarkets.map(m => {
                      const mProb = calcProb(m.q_yes, m.q_no, m.b)
                      const mDiff = parseUTC(m.closes_at).getTime() - Date.now()
                      const mMins = Math.max(0, Math.floor(mDiff / 60000))
                      const mSecs = Math.max(0, Math.floor((mDiff % 60000) / 1000))
                      return (
                        <div key={m.id} onClick={() => router.push(`/markets/${m.id}`)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface)', borderRadius: 10, cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                            <span style={{ fontWeight: 700, fontSize: 13, color: COIN_COLORS[m.coin ?? ''] ?? '#888' }}>{m.coin}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Up or Down</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{String(mMins).padStart(2,'0')}:{String(mSecs).padStart(2,'0')}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: mProb >= 50 ? 'var(--yes)' : 'var(--no)' }}>{mProb}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {isKrypto && !market.resolved && (
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Marktregeln</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                <div>Volumen: <strong style={{ color: 'var(--text)' }}>{Math.round(market.q_yes + market.q_no).toLocaleString('de')} ₫</strong></div>
                <div>Trades: <strong style={{ color: 'var(--text)' }}>{trades.filter(t => t.shares > 0).length}</strong></div>
                <div style={{ marginTop: 12, padding: '12px', background: 'var(--surface)', borderRadius: 8, fontSize: 12, lineHeight: 1.7 }}>
                  Ist der {market.coin}-Preis bei Ablauf <strong style={{ color: 'var(--yes)' }}>höher</strong> → <strong style={{ color: 'var(--yes)' }}>Up gewinnt</strong>.<br />
                  Ist er <strong style={{ color: 'var(--no)' }}>niedriger</strong> → <strong style={{ color: 'var(--no)' }}>Down gewinnt</strong>.
                </div>
              </div>
            </div>
          )}

          {/* Trading Panel */}
          <div className="card" style={{ position: 'sticky', top: 'calc(var(--nav-height) + 16px)', padding: 0, overflow: 'hidden' }}>
            {market.resolved ? (
              <div style={{ padding: '24px 16px' }}>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{userWon ? '🎉' : hasPosition ? '😔' : '✓'}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                    {userWon ? 'Gewonnen!' : hasPosition ? 'Verloren' : 'Markt beendet'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Ergebnis: <strong style={{ color: market.resolution === 'yes' ? 'var(--yes)' : 'var(--no)', fontSize: 15 }}>
                      {market.resolution === 'yes' ? (isKrypto ? '↑ Up' : 'Ja') : (isKrypto ? '↓ Down' : 'Nein')}
                    </strong>
                  </div>
                </div>
                {hasPosition && (
                  <div style={{ padding: '14px', borderRadius: 10, textAlign: 'center', marginBottom: 14, background: userWon ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${userWon ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}` }}>
                    {userWon ? (
                      <>
                        <div style={{ fontSize: 12, color: '#16a34a', marginBottom: 4 }}>Auszahlung erfolgt automatisch</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a' }}>
                          +{Math.round(market.resolution === 'yes' ? sharesYes : sharesNo)} ₫
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 13, color: '#dc2626' }}>Leider verloren — nächsten Markt versuchen!</div>
                    )}
                  </div>
                )}
                {nextLiveMarket && (
                  <button onClick={() => router.push(`/markets/${nextLiveMarket.id}`)}
                    style={{ width: '100%', padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
                    Zum Live-Markt →
                  </button>
                )}
                {!nextLiveMarket && (
                  <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                    Nächster Markt wird erstellt…
                  </div>
                )}
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
                  <select value={orderType} onChange={e => setOrderType(e.target.value as OrderType)}
                    style={{ fontSize: 12, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>
                    <option value="markt">Markt</option>
                    <option value="limit">Limit</option>
                  </select>
                </div>
                <div style={{ padding: 16 }}>
                  {tradeTab === 'kaufen' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                        {(['yes', 'no'] as const).map(d => (
                          <button key={d} onClick={() => setDirection(d)} style={{ padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, background: direction === d ? (d === 'yes' ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)') : 'var(--surface)', color: direction === d ? (d === 'yes' ? 'var(--yes)' : 'var(--no)') : 'var(--text-muted)', outline: direction === d ? `2px solid ${d === 'yes' ? 'var(--yes)' : 'var(--no)'}` : '2px solid transparent' }}>
                            {isKrypto ? (d === 'yes' ? `Up · ${prob}¢` : `Down · ${100 - prob}¢`) : (d === 'yes' ? `Ja · ${prob}¢` : `Nein · ${100 - prob}¢`)}
                          </button>
                        ))}
                      </div>
                      {orderType === 'limit' && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Limitpreis (¢, 1–99)</div>
                          <input type="number" min={1} max={99} value={limitPrice} onChange={e => setLimitPrice(Math.min(99, Math.max(1, parseInt(e.target.value) || 1)))} style={{ width: '100%', fontSize: 16, fontWeight: 600 }} />
                          <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 4 }}>Aktuell: {direction === 'yes' ? prob : 100 - prob}¢</div>
                        </div>
                      )}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Betrag (₫)</div>
                        <input type="number" min={1} max={user.balance} value={spend} onChange={e => setSpend(Math.max(1, parseInt(e.target.value) || 1))} style={{ width: '100%', fontSize: 22, fontWeight: 700 }} />
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          {[50, 100, 200, 500].map(v => (
                            <button key={v} onClick={() => setSpend(v)} style={{ flex: 1, fontSize: 11, padding: '4px 0', borderRadius: 6, border: '1px solid var(--border)', background: spend === v ? 'var(--accent)' : 'var(--surface)', color: spend === v ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}>+{v}</button>
                          ))}
                        </div>
                      </div>
                      {orderType === 'markt' && (
                        <div style={{ background: 'rgba(22,163,74,0.07)', borderRadius: 10, padding: '14px', marginBottom: 14, textAlign: 'center', border: '1px solid rgba(22,163,74,0.2)' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Auszahlung wenn {isKrypto ? (direction === 'yes' ? 'Up' : 'Down') : (direction === 'yes' ? 'Ja' : 'Nein')} eintritt</div>
                          <div style={{ fontSize: 32, fontWeight: 800, color: '#16a34a', letterSpacing: '-0.5px' }}>{payout} ₫</div>
                        </div>
                      )}
                      {orderType === 'limit' && (
                        <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px', marginBottom: 14, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                          Order wird ausgeführt wenn der Kurs {limitPrice}¢ erreicht.
                        </div>
                      )}
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
                            {sharesYes > 0 && <div style={{ fontWeight: 700, color: 'var(--yes)' }}>{isKrypto ? 'Up' : 'Ja'} · {Math.round(sharesYes)} Anteile</div>}
                            {sharesNo  > 0 && <div style={{ fontWeight: 700, color: 'var(--no)'  }}>{isKrypto ? 'Down' : 'Nein'} · {Math.round(sharesNo)} Anteile</div>}
                          </div>
                          {orderType === 'markt' && (
                            <div style={{ background: 'rgba(22,163,74,0.07)', borderRadius: 10, padding: '14px', marginBottom: 14, textAlign: 'center', border: '1px solid rgba(22,163,74,0.2)' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Du erhältst jetzt</div>
                              <div style={{ fontSize: 32, fontWeight: 800, color: '#16a34a', letterSpacing: '-0.5px' }}>{Math.round(returnOnSell)} ₫</div>
                              <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 4 }}>alle Anteile verkaufen</div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                  {betError   && <div className="alert alert-error"   style={{ marginBottom: 10 }}>{betError}</div>}
                  {betSuccess  && <div className="alert alert-success" style={{ marginBottom: 10 }}>{betSuccess}</div>}
                  {tradeTab === 'kaufen' ? (
                    <button className={`submit-btn ${direction === 'yes' ? 'yes' : 'no'}`} onClick={handleKaufen} disabled={betLoading || spend <= 0} style={{ width: '100%' }}>
                      {betLoading ? 'Wird ausgeführt…' : orderType === 'limit' ? `Limit: ${isKrypto ? (direction === 'yes' ? 'Up' : 'Down') : (direction === 'yes' ? 'Ja' : 'Nein')} @ ${limitPrice}¢` : `${isKrypto ? (direction === 'yes' ? 'Up' : 'Down') : (direction === 'yes' ? 'Ja' : 'Nein')} kaufen · ${spend} ₫`}
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
        </div>

        {trades.filter(t => t.shares > 0).length > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Letzte Trades</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...trades].filter(t => t.shares > 0).reverse().slice(0, 10).map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: t.type.includes('yes') ? 'var(--yes)' : 'var(--no)', fontWeight: 600 }}>
                    {isKrypto ? (t.type.includes('yes') ? 'Up' : 'Down') : (t.type.includes('yes') ? 'Ja' : 'Nein')}
                  </span>
                  <span style={{ color: 'var(--text)' }}>{Math.round(Math.abs(t.cost))} ₫</span>
                  <span style={{ color: 'var(--text-subtle)' }}>
                    {new Date(t.created_at).toLocaleDateString('de', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}
