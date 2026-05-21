'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AdminPanel from './components/AdminPanel'
import ProfileView from './components/ProfileView'


const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    cache: 'no-store',
  })
  return res.json()
}

async function supabaseAuth(path: string, body: object) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function dbPost(table: string, body: object, token: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
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
  display_group?: string
  is_auto?: boolean
  coin?: string
  match_id?: string
  outcome?: string
  match_date?: string
  start_price?: number
  end_price?: number
}

interface User {
  id: string
  username: string
  balance: number
  avatar_url?: string
}

interface LeaderboardEntry {
  user_id: string
  username: string
  total_balance: number
  avatar_url?: string
}

interface WeeklyEntry {
  user_id: string
  username: string
  weekly_gain: number
  avatar_url?: string
}
interface WinToast {
  id: string
  coin?: string
  question: string
  amount: number
  isKrypto: boolean
  direction: 'yes' | 'no'
  loserPct?: number
}

function calcProb(qYes: number, qNo: number, b: number): number {
  const eYes = Math.exp(qYes / b)
  const eNo  = Math.exp(qNo  / b)
  return Math.round((eYes / (eYes + eNo)) * 100)
}

function parseUTC(raw: string): Date {
  if (!raw) return new Date(0)
  if (raw.endsWith('Z') || raw.match(/[+-]\d{2}:\d{2}$/)) return new Date(raw)
  if (raw.match(/[+-]\d{2}$/)) return new Date(raw + ':00')
  return new Date(raw.replace(' ', 'T') + 'Z')
}

const AVATAR_COLORS = [
  { bg: '#eff6ff', color: '#1d4ed8' },
  { bg: '#f0fdf4', color: '#166534' },
  { bg: '#fdf4ff', color: '#6b21a8' },
  { bg: '#fffbeb', color: '#92400e' },
  { bg: '#f0f9ff', color: '#075985' },
]

function avatarColor(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

const COINS = ['BTC', 'ETH', 'SOL', 'XRP']

const CAT_CLASS: Record<string, string> = {
  Politik:       'cat-politik',
  Sport:         'cat-sport',
  sport:         'cat-sport',
  Krypto:        'cat-krypto',
  Entertainment: 'cat-entertainment',
  Unterhaltung:  'cat-entertainment',
  Wirtschaft:    'cat-wirtschaft',
  Geopolitik:    'cat-politik',
  Finanzen:      'cat-wirtschaft',
  finance:       'cat-wirtschaft',
  weather:       'cat-sport',
  Wetter:        'cat-sport',
  Kultur:        'cat-entertainment',
  Tech:          'cat-krypto',
}

const COIN_COLORS: Record<string, string> = {
  BTC: '#f59e0b', ETH: '#6366f1', SOL: '#9945ff', XRP: '#00aae4',
}

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ä/g, 'a').replace(/ß/g, 'ss')
    .replace(/\./g, '').replace(/\s+/g, ' ').trim()
}

const TEAM_LOGOS_RAW: Record<string, string> = {
  'fc bayern munchen':          'https://tmssl.akamaized.net/images/wappen/head/27.png',
  'borussia dortmund':          'https://tmssl.akamaized.net/images/wappen/head/16.png',
  'bv borussia 09 dortmund':    'https://tmssl.akamaized.net/images/wappen/head/16.png',
  'rb leipzig':                 'https://tmssl.akamaized.net/images/wappen/head/23826.png',
  'bayer 04 leverkusen':        'https://tmssl.akamaized.net/images/wappen/head/15.png',
  'eintracht frankfurt':        'https://tmssl.akamaized.net/images/wappen/head/24.png',
  'vfb stuttgart':              'https://tmssl.akamaized.net/images/wappen/head/79.png',
  'tsg hoffenheim':             'https://tmssl.akamaized.net/images/wappen/head/533.png',
  'tsg 1899 hoffenheim':        'https://tmssl.akamaized.net/images/wappen/head/533.png',
  'sc freiburg':                'https://tmssl.akamaized.net/images/wappen/head/60.png',
  'borussia monchengladbach':   'https://tmssl.akamaized.net/images/wappen/head/18.png',
  'vfl wolfsburg':              'https://tmssl.akamaized.net/images/wappen/head/82.png',
  'fc augsburg':                'https://tmssl.akamaized.net/images/wappen/head/167.png',
  'sv werder bremen':           'https://tmssl.akamaized.net/images/wappen/head/86.png',
  'mainz 05':                   'https://tmssl.akamaized.net/images/wappen/head/39.png',
  '1 fsv mainz 05':             'https://tmssl.akamaized.net/images/wappen/head/39.png',
  'fsv mainz 05':               'https://tmssl.akamaized.net/images/wappen/head/39.png',
  'fc st pauli':                'https://tmssl.akamaized.net/images/wappen/head/35.png',
  '1 fc union berlin':          'https://tmssl.akamaized.net/images/wappen/head/89.png',
  'union berlin':               'https://tmssl.akamaized.net/images/wappen/head/89.png',
  '1 fc heidenheim 1846':       'https://tmssl.akamaized.net/images/wappen/head/2036.png',
  'fc heidenheim 1846':         'https://tmssl.akamaized.net/images/wappen/head/2036.png',
  'hamburger sv':               'https://tmssl.akamaized.net/images/wappen/head/41.png',
  '1 fc koln':                  'https://tmssl.akamaized.net/images/wappen/head/3.png',
  'fc koln':                    'https://tmssl.akamaized.net/images/wappen/head/3.png',
  'vfl bochum':                 'https://tmssl.akamaized.net/images/wappen/head/80.png',
  'holstein kiel':              'https://tmssl.akamaized.net/images/wappen/head/1896.png',
  'fortuna dusseldorf':         'https://tmssl.akamaized.net/images/wappen/head/44.png',
  'sv darmstadt 98':            'https://tmssl.akamaized.net/images/wappen/head/105.png',
}

function getTeamLogo(name: string): string | undefined {
  return TEAM_LOGOS_RAW[normalizeTeamName(name)]
}

const TEAM_COLORS: Record<string, string> = {
  'FC Bayern München':          '#dc052d',
  'Borussia Dortmund':          '#1a1a1a',
  'BV Borussia 09 Dortmund':    '#1a1a1a',
  'Bayer 04 Leverkusen':        '#e32221',
  'RB Leipzig':                 '#dd0741',
  'Eintracht Frankfurt':        '#e1000f',
  'VfB Stuttgart':              '#e32219',
  'SC Freiburg':                '#e30613',
  'Union Berlin':               '#eb1923',
  '1. FC Union Berlin':         '#eb1923',
  'Borussia Mönchengladbach':   '#000000',
  'VfL Wolfsburg':              '#65b32e',
  'TSG Hoffenheim':             '#1961ae',
  'FC Augsburg':                '#ba3733',
  'SV Werder Bremen':           '#1d9053',
  'Mainz 05':                   '#c1121c',
  '1. FSV Mainz 05':            '#c1121c',
  'VfL Bochum':                 '#005aaa',
  'FC Heidenheim':              '#e2001a',
  '1. FC Heidenheim 1846':      '#e2001a',
  'SV Darmstadt 98':            '#004f9f',
  'Holstein Kiel':              '#c8102e',
  'FC St. Pauli':               '#6b3c26',
  'Hamburger SV':               '#0033a0',
  '1. FC Köln':                 '#e6000f',
  'Fortuna Düsseldorf':         '#e30613',
}

function getTeamColor(name: string): string {
  return TEAM_COLORS[name] ?? '#6366f1'
}

function getTeamInitials(name: string): string {
  const clean = name.replace(/^(1\.\s*)?(FC|BV|SV|TSG|VfB|VfL|SC|RB|FSV)\s+/i, '')
  const words = clean.split(' ').filter(Boolean)
  if (words.length === 1) return words[0].substring(0, 3).toUpperCase()
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase()
}

const SPORT_GROUP_FILTERS: Record<string, string> = {
  'WM':        'Wer wird die WM 2026 gewinnen?',
  'CL':        'Wer gewinnt die Champions League 2025/26?',
  'F1':        'Wer wird F1 Champion 2026?',
  'DFB-Kader': '__null__',
}

const FINANCE_SUB_TABS = [
  { id: 'Finanzen-Tag',   label: 'Aktueller Handelstag',  icon: '📅' },
  { id: 'Finanzen-Woche', label: 'Aktuelle Handelswoche', icon: '📆' },
]

const FINANCE_GROUP_MAP: Record<string, string> = {
  'Finanzen-Tag':   'Aktueller Handelstag',
  'Finanzen-Woche': 'Aktuelle Handelswoche',
}

interface NavItemDef {
  id: string
  label: string
  icon: string
  children?: NavItemDef[]
  parentOnly?: boolean
}

const NAV_ITEMS: NavItemDef[] = [
  { id: 'Politik', label: 'Politik', icon: '🏛️', parentOnly: true, children: [
    { id: 'Politik-Deutschland', label: 'Deutschland', icon: '🇩🇪' },
    { id: 'Politik-USA',        label: 'USA',         icon: '🇺🇸' },
  ]},
  { id: 'Sport', label: 'Sport', icon: '⚽', children: [
    { id: 'Fußball', label: 'Fußball', icon: '⚽', children: [
      { id: 'Bundesliga', label: 'Bundesliga',       icon: '🇩🇪' },
      { id: 'WM',         label: 'WM 2026',          icon: '🏆' },
      { id: 'CL',         label: 'Champions League', icon: '⭐' },
    ]},
    { id: 'F1', label: 'Formel 1', icon: '🏎️' },
  ]},
  { id: 'Krypto',        label: 'Krypto',        icon: '₿'  },
  { id: 'Entertainment', label: 'Entertainment', icon: '🎬' },
  { id: 'Wirtschaft',    label: 'Wirtschaft',    icon: '📈' },
  { id: 'Tech',          label: 'Tech',          icon: '💻' },
  { id: 'Geopolitik',    label: 'Geopolitik',    icon: '🌍' },
  { id: 'Finanzen', label: 'Finanzen', icon: '💰', parentOnly: true, children: FINANCE_SUB_TABS },
  { id: 'Wetter',        label: 'Wetter',        icon: '🌤️' },
  { id: 'Kultur',        label: 'Kultur',        icon: '🎭' },
]

type AuthMode = 'login' | 'register'

export default function Home() {
  const router = useRouter()
  const [markets, setMarkets]                 = useState<Market[]>([])
  const [pastSoccerMarkets, setPastSoccerMarkets] = useState<Market[]>([])
  const [user, setUser]                       = useState<User | null>(null)
  const [leaderboard, setLeaderboard]         = useState<LeaderboardEntry[]>([])
  const [weeklyBoard, setWeeklyBoard]         = useState<WeeklyEntry[]>([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [category, setCategory]               = useState('Politik-Deutschland')
  const [view, setView]                       = useState<'markets' | 'portfolio' | 'admin' | 'profil'>('markets')
  const [loading, setLoading]                 = useState(true)
  const [darkMode, setDarkMode]               = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('mobius_darkmode') === 'true'
  })
  const [showAuth, setShowAuth]               = useState(false)
  const [authMode, setAuthMode]               = useState<AuthMode>('login')
  const [authEmail, setAuthEmail]             = useState('')
  const [authPassword, setAuthPassword]       = useState('')
  const [authUsername, setAuthUsername]       = useState('')
  const [authError, setAuthError]             = useState('')
  const [authLoading, setAuthLoading]         = useState(false)
  const [searchQuery, setSearchQuery]         = useState('')
  const [winToasts, setWinToasts]             = useState<WinToast[]>([])
  const [expandedNav, setExpandedNav]         = useState<Record<string, boolean>>({ Sport: true, Fußball: true, Politik: true })
  const shownToastsRef                        = useRef<Set<string>>(new Set())
  const userRef                               = useRef<User | null>(null)
  const marketsRef                            = useRef<Market[]>([])
  const triggeredCoinsRef                     = useRef<Record<string, number>>({})

  const ADMIN_ID = 'b75edaf4-141d-41f1-9555-887a8ddbac58'

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mobius_shown_toasts')
      if (saved) {
        const ids: string[] = JSON.parse(saved)
        ids.forEach(id => shownToastsRef.current.add(id))
      }
    } catch {}
  }, [])

  useEffect(() => {
    const cat = new URLSearchParams(window.location.search).get('category')
    if (cat) setCategory(cat)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('mobius_darkmode', String(darkMode))
  }, [darkMode])

  useEffect(() => {
    const saved = localStorage.getItem('mobius_session')
    if (!saved) return
    try {
      const session = JSON.parse(saved)
      if (session?.access_token && session?.user_id) {
        dbGet('users', `id=eq.${session.user_id}&select=*`).then((data) => {
          if (data?.[0]) { setUser(data[0]); userRef.current = data[0] }
        })
      }
    } catch {}
  }, [])

  const loadMarkets = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    const data = await dbGet('markets', 'status=eq.open&select=*&order=created_at.desc')
    const list = data ?? []
    setMarkets(list)
    marketsRef.current = list
    setLoading(false)
  }, [])

  const loadPastSoccerMarkets = useCallback(async () => {
    const data = await dbGet(
      'markets',
      'resolved=eq.true&match_id=not.is.null&select=*&order=closes_at.desc&limit=162'
    )
    setPastSoccerMarkets(data ?? [])
  }, [])

  const loadLeaderboard = useCallback(async () => {
    const data = await dbGet('users', 'select=id,username,balance,avatar_url&order=balance.desc&limit=10')
    setLeaderboard(
      (data ?? []).map((u: User) => ({
        user_id: u.id,
        username: u.username,
        total_balance: u.balance,
        avatar_url: u.avatar_url,
      }))
    )
  }, [])

  const loadWeeklyBoard = useCallback(async () => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const trades = await dbGet('trades', `type=eq.payout&created_at=gte.${since}&select=user_id,shares`)
if (!trades || trades.length === 0) { setWeeklyBoard([]); return }
const gainMap: Record<string, number> = {}
trades.forEach((t: { user_id: string; shares: number }) => {
  gainMap[t.user_id] = (gainMap[t.user_id] ?? 0) + (t.shares ?? 0)
})
    const topIds = Object.entries(gainMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id)
    if (topIds.length === 0) { setWeeklyBoard([]); return }
const users = await dbGet('users', `id=in.(${topIds.join(',')})&select=id,username,avatar_url`)
const userMap: Record<string, { username: string; avatar_url?: string }> = {}
users?.forEach((u: { id: string; username: string; avatar_url?: string }) => { userMap[u.id] = { username: u.username, avatar_url: u.avatar_url } })
setWeeklyBoard(topIds.map(id => ({ user_id: id, username: userMap[id]?.username ?? 'Unbekannt', weekly_gain: Math.round(gainMap[id]), avatar_url: userMap[id]?.avatar_url })))
  }, [])

  useEffect(() => { loadMarkets(true); loadLeaderboard() }, [loadMarkets, loadLeaderboard])

  useEffect(() => {
    if (category === 'Bundesliga') loadPastSoccerMarkets()
  }, [category, loadPastSoccerMarkets])

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      const autoMarkets = marketsRef.current.filter(m => m.is_auto && m.coin && !m.resolved && !m.match_id && m.category !== 'weather' && m.category !== 'Wetter')
      for (const coin of COINS) {
        const market = autoMarkets.find(m => m.coin === coin)
        if (!market) {
          const lastTriggered = triggeredCoinsRef.current[coin + '_missing'] ?? 0
          if (now - lastTriggered > 30000) {
            triggeredCoinsRef.current[coin + '_missing'] = now
            fetch('/api/create-crypto-market', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coin }) }).then(() => loadMarkets()).catch(() => {})
          }
          continue
        }
        const closesAtMs = parseUTC(market.closes_at).getTime()
        const diff       = closesAtMs - now
        const triggerKey = coin + '_' + closesAtMs
        if (diff < 10000 && diff > -30000 && !triggeredCoinsRef.current[triggerKey]) {
          triggeredCoinsRef.current[triggerKey] = now
          fetch('/api/create-crypto-market', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coin }) }).then(() => setTimeout(loadMarkets, 2000)).catch(() => {})
        }
      }
    }, 1000)
    return () => clearInterval(id)
  }, [loadMarkets])

  useEffect(() => {
    const id = setInterval(() => loadMarkets(), 10000)
    return () => clearInterval(id)
  }, [loadMarkets])

  const checkWins = useCallback(async (userId: string) => {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const trades = await dbGet('trades', `user_id=eq.${userId}&type=in.(buy_yes,buy_no)&created_at=gte.${since}&select=market_id,type,shares`)
    if (!trades || trades.length === 0) return
    const seen: Record<string, boolean> = {}
    const marketIds: string[] = []
    trades.forEach((t: { market_id: string }) => { if (!seen[t.market_id]) { seen[t.market_id] = true; marketIds.push(t.market_id) } })
    const resolvedMarkets = await dbGet('markets', `id=in.(${marketIds.join(',')})&resolved=eq.true&select=id,question,resolution,is_auto,coin,q_yes,q_no,b`)
    if (!resolvedMarkets || resolvedMarkets.length === 0) return
    const newToasts: WinToast[] = []
    for (const market of resolvedMarkets) {
      if (shownToastsRef.current.has(market.id)) continue
      const marketTrades = trades.filter((t: { market_id: string; type: string; shares: number }) => t.market_id === market.id)
      const wonTrades = marketTrades.filter((t: { type: string }) => (market.resolution === 'yes' && t.type === 'buy_yes') || (market.resolution === 'no' && t.type === 'buy_no'))
      if (wonTrades.length === 0) continue
      const totalShares = wonTrades.reduce((s: number, t: { shares: number }) => s + (t.shares ?? 0), 0)
      const amount = Math.round(totalShares)
      if (amount <= 0) continue
      const probAtResolution = calcProb(market.q_yes, market.q_no, market.b)
      const loserPct = market.resolution === 'yes' ? (100 - probAtResolution) : probAtResolution
      shownToastsRef.current.add(market.id)
      try {
        const existing: string[] = JSON.parse(localStorage.getItem('mobius_shown_toasts') ?? '[]')
        existing.push(market.id)
        localStorage.setItem('mobius_shown_toasts', JSON.stringify(existing.slice(-200)))
      } catch {}
      newToasts.push({ id: market.id, coin: market.coin, question: market.question, amount, isKrypto: !!market.is_auto, direction: market.resolution as 'yes' | 'no', loserPct })
    }
    if (newToasts.length > 0) {
      setWinToasts(prev => [...prev, ...newToasts])
      const freshUser = await dbGet('users', `id=eq.${userId}&select=balance`)
      if (freshUser?.[0]) { setUser(prev => prev ? { ...prev, balance: freshUser[0].balance } : prev); userRef.current = { ...userRef.current!, balance: freshUser[0].balance } }
      newToasts.forEach(toast => { setTimeout(() => setWinToasts(prev => prev.filter(t => t.id !== toast.id)), 7000) })
    }
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const id = setInterval(() => checkWins(user.id), 15000)
    checkWins(user.id)
    return () => clearInterval(id)
  }, [user?.id, checkWins])

  const handleLogin = async () => {
    setAuthError('')
    if (!authEmail || !authPassword) { setAuthError('Bitte alle Felder ausfüllen.'); return }
    if (authEmail.length > 254) { setAuthError('E-Mail zu lang.'); return }
    if (authPassword.length < 6 || authPassword.length > 128) { setAuthError('Passwort muss 6–128 Zeichen lang sein.'); return }
    setAuthLoading(true)
    const res = await supabaseAuth('token?grant_type=password', { email: authEmail.trim(), password: authPassword })
    setAuthLoading(false)
    if (res.error || !res.access_token) { setAuthError('E-Mail oder Passwort falsch.'); return }
    const userId = res.user?.id
    const userData = await dbGet('users', `id=eq.${userId}&select=*`)
    if (userData?.[0]) {
      setUser(userData[0]); userRef.current = userData[0]
      localStorage.setItem('mobius_session', JSON.stringify({ access_token: res.access_token, user_id: userId }))
      setShowAuth(false); resetAuthForm()
    } else { setAuthError('Benutzer nicht gefunden.') }
  }

  const handleRegister = async () => {
    setAuthError('')
    if (!authEmail || !authPassword || !authUsername) { setAuthError('Bitte alle Felder ausfüllen.'); return }
    if (authEmail.length > 254) { setAuthError('E-Mail zu lang.'); return }
    if (authUsername.length < 3 || authUsername.length > 50) { setAuthError('Benutzername: 3–50 Zeichen.'); return }
    if (authPassword.length < 6 || authPassword.length > 128) { setAuthError('Passwort muss 6–128 Zeichen lang sein.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail.trim())) { setAuthError('Ungültige E-Mail-Adresse.'); return }
    setAuthLoading(true)
    const existing = await dbGet('users', `username=eq.${encodeURIComponent(authUsername.trim())}&select=id`)
    if (existing?.length > 0) { setAuthLoading(false); setAuthError('Benutzername bereits vergeben.'); return }
    const res = await supabaseAuth('signup', { email: authEmail.trim(), password: authPassword })
    setAuthLoading(false)
    if (res.error) { setAuthError(res.error.message ?? 'Registrierung fehlgeschlagen.'); return }
    const userId = res.user?.id
    const token = res.access_token
    if (!userId) { setAuthError('Bitte bestätige deine E-Mail und melde dich dann an.'); return }
    await dbPost('users', { id: userId, username: authUsername.trim().slice(0, 50), balance: 1000 }, token ?? SUPABASE_KEY)
    const userData = await dbGet('users', `id=eq.${userId}&select=*`)
    if (userData?.[0]) {
      setUser(userData[0]); userRef.current = userData[0]
      localStorage.setItem('mobius_session', JSON.stringify({ access_token: token, user_id: userId }))
      setShowAuth(false); resetAuthForm(); loadLeaderboard()
    } else { setAuthError('Konto erstellt! Bitte melde dich jetzt an.') }
  }

  const handleLogout = () => {
    setUser(null); userRef.current = null
    localStorage.removeItem('mobius_session')
    setView('markets'); setWinToasts([]); shownToastsRef.current = new Set()
  }

  const resetAuthForm = () => { setAuthEmail(''); setAuthPassword(''); setAuthUsername(''); setAuthError('') }
  const openAuth = (mode: AuthMode) => { resetAuthForm(); setAuthMode(mode); setShowAuth(true) }

  const isSportCategory = category === 'Sport' || category === 'Fußball' || category === 'Bundesliga'
    || category === 'WM' || category === 'CL' || category === 'DFB-Kader'
  const isFinanzCategory = category.startsWith('Finanzen-')

  function isPolitikDeutschland(m: Market): boolean {
    return m.category === 'Politik' && !!(m.group_title && m.group_title.toLowerCase().includes('landtag'))
  }
  function isPolitikUSA(m: Market): boolean {
    if (m.category !== 'Politik') return false
    if (m.group_title) return false
    const q = (m.question ?? '').toLowerCase()
    return q.includes('trump') || q.includes('demokraten') || q.includes('us-senat') || q.includes('usa') || q.includes('senat 2026')
  }
  function isPolitikWelt(m: Market): boolean {
    if (m.category !== 'Politik') return false
    if (isPolitikDeutschland(m)) return false
    if (isPolitikUSA(m)) return false
    return true
  }

  const filteredMarkets = markets.filter((m) => {
    let matchCat = false
    if (category === 'Politik-Deutschland') {
      matchCat = isPolitikDeutschland(m)
    } else if (category === 'Politik-USA') {
      matchCat = isPolitikUSA(m)
    } else if (category === 'Politik-Welt') {
      matchCat = isPolitikWelt(m)
    } else if (category === 'Bundesliga') {
      matchCat = !!m.match_id
    } else if (category === 'Fußball') {
      matchCat = m.category === 'sport' || m.category === 'Sport'
    } else if (category === 'Sport') {
      matchCat = m.category === 'sport' || m.category === 'Sport'
    } else if (category === 'WM' || category === 'CL') {
      const groupFilter = SPORT_GROUP_FILTERS[category]
      matchCat = m.group_title === groupFilter
    } else if (category === 'F1') {
      matchCat = m.category === 'formula1'
    } else if (category === 'DFB-Kader') {
      matchCat = (m.category === 'Sport' || m.category === 'sport') && !m.group_title && !m.match_id
    } else if (category === 'Entertainment') {
      matchCat = m.category === 'Entertainment' || m.category === 'Unterhaltung'
    } else if (category === 'Krypto') {
      matchCat = m.category === 'Krypto' || m.category === 'krypto'
    } else if (category.startsWith('Finanzen-')) {
      const groupTitle = FINANCE_GROUP_MAP[category]
      matchCat = (m.category === 'finance' || m.category === 'Finanzen') && m.group_title === groupTitle
    } else if (category === 'Wetter') {
      matchCat = m.category === 'weather' || m.category === 'Wetter'
    } else {
      matchCat = m.category === category || m.category === category.toLowerCase()
    }
    const matchSearch = searchQuery === '' ||
      (m.question ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.short_label ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.display_group ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    return matchCat && matchSearch
  })

  const toggleNav = (id: string) => setExpandedNav(prev => ({ ...prev, [id]: !prev[id] }))
  const selectCategory = (id: string) => { setCategory(id); setView('markets'); setSearchQuery('') }

  const categoryLabel: Record<string, string> = {
    'Politik-Deutschland': 'Politik · Deutschland',
    'Politik-USA':         'Politik · USA',
    'Politik-Welt':        'Politik · Welt',
    'Finanzen-Tag':        'Finanzen · Aktueller Handelstag',
    'Finanzen-Woche':      'Finanzen · Aktuelle Handelswoche',
    'F1':                  'Formel 1',
  }

  return (
    <>
      {/* Win Toasts */}
      <div style={{ position: 'fixed', top: 80, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
        {winToasts.map(toast => {
          const isUp = toast.direction === 'yes'
const accentColor = toast.isKrypto ? (isUp ? '#16a34a' : '#dc2626') : '#16a34a'
          return (
            <div key={toast.id} style={{ pointerEvents: 'all', background: 'var(--bg, #fff)', border: `1px solid ${isUp ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`, borderLeft: `4px solid ${accentColor}`, borderRadius: 12, padding: '14px 16px', minWidth: 270, maxWidth: 330, boxShadow: '0 4px 24px rgba(0,0,0,0.12)', animation: 'slideInRight 0.3s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {toast.isKrypto && toast.coin && (<span style={{ width: 22, height: 22, borderRadius: 6, background: COIN_COLORS[toast.coin] ?? '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{toast.coin.charAt(0)}</span>)}
                  <span style={{ fontSize: 12, fontWeight: 700, color: accentColor, letterSpacing: 0.3 }}>{toast.isKrypto ? (isUp ? `${toast.coin} · UP ↑` : `${toast.coin} · DOWN ↓`) : 'POSITION GEWONNEN'}</span>
                </div>
                <button onClick={() => setWinToasts(prev => prev.filter(t => t.id !== toast.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af', padding: 0, lineHeight: 1 }}>×</button>
              </div>
              {!toast.isKrypto && (<div style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)', marginBottom: 8, lineHeight: 1.4 }}>{toast.question.length > 55 ? toast.question.slice(0, 55) + '…' : toast.question}</div>)}
              <div style={{ fontSize: 26, fontWeight: 900, color: accentColor, letterSpacing: '-0.5px', lineHeight: 1, marginBottom: 6 }}>+{toast.amount.toLocaleString('de')} ₫</div>
              {toast.loserPct !== undefined && toast.loserPct > 5 && (<div style={{ fontSize: 11, color: 'var(--text-muted, #9ca3af)', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 6, marginTop: 2 }}>{toast.loserPct}% der Marktteilnehmer lagen falsch.</div>)}
            </div>
          )
        })}
      </div>

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="modal-backdrop" onClick={() => setShowLeaderboard(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div><div className="modal-title" style={{ marginBottom: 2 }}>Wochenranking</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Top-Händler der letzten 7 Tage</div></div>
              <button onClick={() => setShowLeaderboard(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
            </div>
            {weeklyBoard.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>Noch keine Daten für diese Woche.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {weeklyBoard.map((e, i) => {
                  const av = avatarColor(e.username); const isMe = e.user_id === user?.id
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
                  return (
                    <div key={e.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: isMe ? 'var(--accent-light, rgba(99,102,241,0.08))' : 'var(--surface)', border: isMe ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent' }}>
                      <span style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 }}>{medal}</span>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{e.username.slice(0, 2).toUpperCase()}</div>
                      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: isMe ? 700 : 500, flex: 1 }}>{e.username}{isMe ? ' (du)' : ''}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>+{e.weekly_gain.toLocaleString('de')} ₫</span>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-subtle)', textAlign: 'center', marginTop: 16 }}>Resets jeden Montag · Basiert auf realisierten Gewinnen</div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuth && (
        <div className="modal-backdrop" onClick={() => setShowAuth(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{authMode === 'login' ? 'Anmelden' : 'Konto erstellen'}</div>
            <div className="auth-tabs">
              <button className={`auth-tab ${authMode === 'login' ? 'active' : ''}`} onClick={() => { setAuthMode('login'); setAuthError('') }}>Anmelden</button>
              <button className={`auth-tab ${authMode === 'register' ? 'active' : ''}`} onClick={() => { setAuthMode('register'); setAuthError('') }}>Registrieren</button>
            </div>
            {authMode === 'register' && (<input type="text" placeholder="Benutzername" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} maxLength={50} style={{ width: '100%' }} />)}
            <input type="email" placeholder="E-Mail" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} maxLength={254} style={{ width: '100%' }} autoFocus />
            <input type="password" placeholder="Passwort" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} maxLength={128} onKeyDown={(e) => e.key === 'Enter' && (authMode === 'login' ? handleLogin() : handleRegister())} style={{ width: '100%' }} />
            {authError && <div className="alert alert-error">{authError}</div>}
            <button className="submit-btn yes" onClick={authMode === 'login' ? handleLogin : handleRegister} disabled={authLoading} style={{ marginTop: 4 }}>
              {authLoading ? 'not me waiting...' : authMode === 'login' ? 'Anmelden' : 'Konto erstellen'}
            </button>
            {authMode === 'register' && (<div style={{ fontSize: 12, color: 'var(--text-subtle)', textAlign: 'center' }}>Du startest mit 1.000 ₫ Dukaten.</div>)}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="nav">
        <div className="nav-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-weiss.png" alt="Möbius" className="nav-logo" onClick={() => { setView('markets'); setSearchQuery(''); setCategory('Politik-Deutschland') }} />
          <div className="nav-search-wrap">
            <span className="nav-search-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input className="nav-search" type="text" placeholder="Märkte durchsuchen…" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setView('markets') }} />
          </div>
        </div>
        <div className="nav-right">
          {user ? (
            <>
              <button className="nav-pill" onClick={() => { loadWeeklyBoard(); setShowLeaderboard(true) }} style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                <span style={{ fontSize: 13 }}>🏆</span><span>Ranking</span>
              </button>
              <div className="nav-stat"><div className="nav-stat-label">Guthaben</div><div className="nav-stat-value">{user.balance.toLocaleString('de')} ₫</div></div>
              <div className="nav-divider" />
              {user?.id === ADMIN_ID && (<button className="nav-pill" onClick={() => setView('admin')} style={{ background: 'rgba(124,58,237,0.25)', borderColor: 'rgba(124,58,237,0.5)', color: '#c4b5fd' }}>Admin</button>)}
            </>
          ) : (
            <>
              <button className="nav-pill" onClick={() => openAuth('login')}>Anmelden</button>
              <button className="nav-pill accent" onClick={() => openAuth('register')}>Registrieren</button>
            </>
          )}
          <button className="nav-icon-btn" onClick={() => setDarkMode(!darkMode)}>{darkMode ? '☀️' : '🌙'}</button>
          {user && (
            <>
              <div className="nav-avatar" onClick={() => setView('profil')} title={user.username}>
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar_url} alt={user.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <span>{user.username.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <button className="nav-pill" onClick={handleLogout}>Abmelden</button>
            </>
          )}
        </div>
      </nav>

      {/* Layout */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--nav-height, 56px))', maxWidth: 1400, margin: '0 auto' }}>
        <aside style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', padding: '20px 0', position: 'sticky', top: 'var(--nav-height, 56px)', height: 'calc(100vh - var(--nav-height, 56px))', overflowY: 'auto', background: 'var(--bg)' }}>
          {user && (<div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--border)', marginBottom: 12 }}><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Guthaben</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{user.balance.toLocaleString('de')} ₫</div></div>)}
          <div style={{ padding: '0 8px' }}>
            {NAV_ITEMS.map(item => (<NavItem key={item.id} item={item} category={category} expandedNav={expandedNav} onSelect={selectCategory} onToggle={toggleNav} depth={0} />))}
          </div>
        </aside>

        <main style={{ flex: 1, minWidth: 0, padding: '24px 32px' }}>
          {view === 'admin' && user?.id === ADMIN_ID && (<AdminPanel userId={user.id} openMarkets={markets} onMarketResolved={loadMarkets} />)}
          {view === 'profil' && user && (<ProfileView userId={user.id} token={user.id} displayName={user.username} avatarUrl={user.avatar_url ?? ''} balance={user.balance} onUsernameChange={(name) => setUser({ ...user, username: name })} onAvatarChange={(url) => setUser({ ...user, avatar_url: url })} />)}
          {view === 'markets' && (
            <>
              <div className="section-head">
                <div className="section-title" style={{ fontSize: 22, fontWeight: 800 }}>{searchQuery ? `Suche: „${searchQuery}"` : (categoryLabel[category] ?? category)}</div>
                <div className="section-link" onClick={() => loadMarkets()}>Aktualisieren</div>
              </div>
              {isFinanzCategory && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                  {FINANCE_SUB_TABS.map(tab => (
                    <button key={tab.id} onClick={() => selectCategory(tab.id)} style={{ padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: category === tab.id ? 700 : 500, border: category === tab.id ? '1px solid var(--accent, #6366f1)' : '1px solid var(--border)', background: category === tab.id ? 'var(--accent-light, rgba(99,102,241,0.1))' : 'var(--surface)', color: category === tab.id ? 'var(--accent, #6366f1)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}>
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>
              )}
              {loading ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '24px 0' }}>it´s giving... data</div>
              ) : filteredMarkets.length === 0 && category !== 'Bundesliga' ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '24px 0' }}>
                  {isFinanzCategory ? 'Derzeit sind keine Märkte aktiv. Sie starten automatisch zu Beginn der offiziellen Handelszeiten der deutschen (09:00 – 17:30 Uhr) und amerikanischen Börsen (15:30 – 22:00 Uhr).' : 'Keine Märkte gefunden.'}
                </div>
              ) : (
                <MarketsGrid markets={filteredMarkets} onOpen={(id) => router.push(`/markets/${id}`)} isSoccer={isSportCategory} />
              )}
              {category === 'Bundesliga' && pastSoccerMarkets.length > 0 && (<PastSoccerSection markets={pastSoccerMarkets} onOpen={(id) => router.push(`/markets/${id}`)} />)}
            </>
          )}
          {view === 'portfolio' && user && (<PortfolioView userId={user.id} router={router} />)}
        </main>
      </div>
      <style>{`
        @keyframes slideInRight { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .nav-item-btn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: none; background: transparent; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--text-muted); text-align: left; transition: background 0.1s, color 0.1s; }
        .nav-item-btn:hover { background: var(--surface); color: var(--text); }
        .nav-item-btn.active { background: var(--accent-light, rgba(99,102,241,0.1)); color: var(--accent, #6366f1); font-weight: 700; }
        .nav-chevron { margin-left: auto; font-size: 10px; opacity: 0.5; transition: transform 0.2s; }
        .nav-chevron.open { transform: rotate(180deg); }
      `}</style>
    </>
  )
}

function NavItem({ item, category, expandedNav, onSelect, onToggle, depth }: {
  item: NavItemDef; category: string; expandedNav: Record<string, boolean>
  onSelect: (id: string) => void; onToggle: (id: string) => void; depth: number
}) {
  const hasChildren = item.children && item.children.length > 0
  const isExpanded  = expandedNav[item.id]
  const isActive    = category === item.id || (item.id === 'Politik' && category.startsWith('Politik-')) || (item.id === 'Finanzen' && category.startsWith('Finanzen-'))
  const handleClick = () => {
    if (item.parentOnly) { onToggle(item.id) }
    else if (hasChildren) { onToggle(item.id); onSelect(item.id) }
    else { onSelect(item.id) }
  }
  return (
    <div>
      <button className={`nav-item-btn ${isActive ? 'active' : ''}`} style={{ paddingLeft: 12 + depth * 12 }} onClick={handleClick}>
        <span style={{ fontSize: 14 }}>{item.icon}</span>
        <span>{item.label}</span>
        {hasChildren && <span className={`nav-chevron ${isExpanded ? 'open' : ''}`}>▼</span>}
      </button>
      {hasChildren && isExpanded && (
        <div>{item.children!.map(child => (<NavItem key={child.id} item={child} category={category} expandedNav={expandedNav} onSelect={onSelect} onToggle={onToggle} depth={depth + 1} />))}</div>
      )}
    </div>
  )
}

function TeamLogo({ teamName, color, size = 36 }: { teamName: string; color: string; size?: number }) {
  const [imgError, setImgError] = useState(false)
  const logoUrl = getTeamLogo(teamName)
  if (logoUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt={teamName} onError={() => setImgError(true)} style={{ width: size, height: size, borderRadius: 6, objectFit: 'contain', background: '#fff', padding: 3, flexShrink: 0 }} />
    )
  }
  return (<div style={{ width: size, height: size, borderRadius: 6, flexShrink: 0, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 900, color: '#fff' }}>{getTeamInitials(teamName)}</div>)
}

function PastSoccerSection({ markets, onOpen }: { markets: Market[]; onOpen: (id: string) => void }) {
  const [scores, setScores] = useState<Record<string, { home: number; away: number }>>({})
  useEffect(() => {
    const fetchScores = async () => {
      try {
        const season = new Date().getMonth() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1
        const res = await fetch(`https://api.openligadb.de/getmatchdata/bl1/${season}`, { cache: 'no-store' })
        if (!res.ok) return
        const allMatches = await res.json()
        const scoreMap: Record<string, { home: number; away: number }> = {}
        for (const match of allMatches) {
          if (!match.matchIsFinished) continue
          const final = match.matchResults?.find((r: { resultTypeID: number }) => r.resultTypeID === 2)
          if (final) { const key = `bl1-${match.matchID}`; scoreMap[key] = { home: final.pointsTeam1, away: final.pointsTeam2 } }
        }
        setScores(scoreMap)
      } catch {}
    }
    fetchScores()
  }, [])

  const matchGroups: Record<string, Market[]> = {}
  markets.forEach(m => { if (!m.match_id) return; if (!matchGroups[m.match_id]) matchGroups[m.match_id] = []; matchGroups[m.match_id].push(m) })
  const sortedMatches = Object.entries(matchGroups).sort(([, a], [, b]) => parseUTC(b[0].closes_at).getTime() - parseUTC(a[0].closes_at).getTime())
  if (sortedMatches.length === 0) return null

  const byDate: Record<string, [string, Market[]][]> = {}
  sortedMatches.forEach(([matchId, matchMarkets]) => {
    const d = parseUTC(matchMarkets[0].closes_at)
    const dateKey = d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' })
    if (!byDate[dateKey]) byDate[dateKey] = []
    byDate[dateKey].push([matchId, matchMarkets])
  })

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Abgeschlossene Spiele</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)' }}>{sortedMatches.length} Spiele</div>
      </div>
      {Object.entries(byDate).map(([, dayMatches]) => (
        <div key={dayMatches[0][0]} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {dayMatches.map(([matchId, matchMarkets]) => (<PastMatchRow key={matchId} markets={matchMarkets} score={scores[matchId]} onOpen={onOpen} />))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PastMatchRow({ markets, score, onOpen }: { markets: Market[]; score?: { home: number; away: number }; onOpen: (id: string) => void }) {
  const home = markets.find(m => m.outcome === 'home') ?? markets[0]
  const draw = markets.find(m => m.outcome === 'draw')
  const away = markets.find(m => m.outcome === 'away')
  const displayGroup = home.display_group ?? ''
  const teams = displayGroup.split(' vs ')
  const homeTeam = teams[0]?.trim() ?? ''; const awayTeam = teams[1]?.trim() ?? ''
  const homeColor = getTeamColor(homeTeam); const awayColor = getTeamColor(awayTeam)
  const homeProb = home ? calcProb(home.q_yes, home.q_no, home.b) : 33
  const drawProb = draw ? calcProb(draw.q_yes, draw.q_no, draw.b) : 34
  const awayProb = away ? calcProb(away.q_yes, away.q_no, away.b) : 33
  const total = homeProb + drawProb + awayProb
  const homeNorm = Math.round((homeProb / total) * 100); const awayNorm = Math.round((awayProb / total) * 100)
  const homeWon = home?.resolution === 'yes'; const awayWon = away?.resolution === 'yes'; const isDraw = draw?.resolution === 'yes'
  const winnerName = homeWon ? homeTeam : awayWon ? awayTeam : isDraw ? 'Unentschieden' : '—'
  const winnerColor = homeWon ? homeColor : awayWon ? awayColor : '#64748b'
  return (
    <div onClick={() => onOpen(home.id)} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <TeamLogo teamName={homeTeam} color={homeColor} size={28} />
        <span style={{ fontSize: 13, fontWeight: homeWon ? 700 : 500, color: homeWon ? 'var(--text)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{homeTeam}</span>
        <span style={{ fontSize: 12, color: homeColor, fontWeight: 600, flexShrink: 0 }}>{homeNorm}%</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        {score ? (<div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>{score.home} : {score.away}</div>) : null}
        <div style={{ padding: '2px 10px', borderRadius: 6, background: `${winnerColor}15`, border: `1px solid ${winnerColor}33`, fontSize: 11, fontWeight: 700, color: winnerColor, whiteSpace: 'nowrap' }}>{winnerName}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 12, color: awayColor, fontWeight: 600, flexShrink: 0 }}>{awayNorm}%</span>
        <span style={{ fontSize: 13, fontWeight: awayWon ? 700 : 500, color: awayWon ? 'var(--text)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{awayTeam}</span>
        <TeamLogo teamName={awayTeam} color={awayColor} size={28} />
      </div>
    </div>
  )
}

// ── Wetter-Karte ─────────────────────────────────────────────────────────────
function WeatherMarketCard({ market, onClick }: { market: Market; onClick: () => void }) {
  const prob  = calcProb(market.q_yes, market.q_no, market.b)
  const isLow = prob < 50
  const city  = market.short_label ?? market.display_group ?? market.question

  // Temperatur aus question parsen: "...heute? (17°C)" → "17°C"
  const tempMatch = market.question.match(/\((-?\d+\.?\d*)°C\)/)
  const temp = tempMatch ? `${tempMatch[1]}°C` : (market.start_price != null ? `${market.start_price}°C` : null)

  return (
    <div className="market-card" onClick={onClick} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 18 }}>🌤</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{city}</span>
        </div>
        {temp && (
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0ea5e9', background: 'rgba(14,165,233,0.1)', padding: '2px 8px', borderRadius: 8 }}>
            {temp} gestern
          </span>
        )}
      </div>
      <div className="market-card-question" style={{ fontSize: 13, marginBottom: 10 }}>
        Wird es heute wärmer?
      </div>
      <div className="prob-bar">
        <div className={`prob-bar-fill ${isLow ? 'low' : ''}`} style={{ width: `${prob}%` }} />
      </div>
      <div className="market-card-footer">
        <div className={`market-prob ${isLow ? 'low' : ''}`}>{prob}%</div>
        <div className="market-volume">{Math.round(market.q_yes + market.q_no)} ₫ Vol.</div>
      </div>
      <div className="bet-btns">
        <button className="btn-yes" onClick={(e) => { e.stopPropagation(); onClick() }}>Ja {prob}%</button>
        <button className="btn-no" onClick={(e) => { e.stopPropagation(); onClick() }}>Nein {100 - prob}%</button>
      </div>
    </div>
  )
}

function MarketsGrid({ markets, onOpen, isSoccer }: { markets: Market[]; onOpen: (id: string) => void; isSoccer: boolean }) {
  // ── Wetter-Märkte: immer als Einzelkarten, nie als Gruppe ─────────────────
  const weatherMarkets = markets.filter(m => m.category === 'weather' || m.category === 'Wetter')
  const nonWeatherMarkets = markets.filter(m => m.category !== 'weather' && m.category !== 'Wetter')

  const soccerGroups: Record<string, Market[]> = {}
  const otherMarkets: Market[] = []

  nonWeatherMarkets.forEach((m) => {
    if (m.match_id) {
      if (!soccerGroups[m.match_id]) soccerGroups[m.match_id] = []
      soccerGroups[m.match_id].push(m)
    } else {
      otherMarkets.push(m)
    }
  })

  const soccerEntries = Object.entries(soccerGroups)
  const soccerByDate: Record<string, [string, Market[]][]> = {}
  soccerEntries.forEach(([matchId, matchMarkets]) => {
    const anyMarket = matchMarkets[0]
    const dateKey = anyMarket.match_date?.split(',').slice(0, 2).join(',').trim() ?? 'Sonstige'
    if (!soccerByDate[dateKey]) soccerByDate[dateKey] = []
    soccerByDate[dateKey].push([matchId, matchMarkets])
  })

  const FINANCE_SECTION_ORDER = ['Indizes', 'Aktien', 'Rohstoffe & Forex']
  const financeSections: Record<string, Market[]> = { 'Indizes': [], 'Aktien': [], 'Rohstoffe & Forex': [] }
  const FINANCE_CATEGORY_MAP: Record<string, string> = {
    '^GDAXI': 'Indizes', '^GSPC': 'Indizes', '^NDX': 'Indizes', '^STOXX50E': 'Indizes',
    'NVDA': 'Aktien', 'AAPL': 'Aktien', 'MSFT': 'Aktien', 'GOOGL': 'Aktien',
    'AMZN': 'Aktien', 'META': 'Aktien', 'AVGO': 'Aktien', 'TSLA': 'Aktien', 'SAP': 'Aktien',
    'GC=F': 'Rohstoffe & Forex', 'SI=F': 'Rohstoffe & Forex', 'CL=F': 'Rohstoffe & Forex', 'EURUSD=X': 'Rohstoffe & Forex',
  }

  const isFinance = otherMarkets.length > 0 && otherMarkets.every(m => m.category === 'finance' || m.category === 'Finanzen')
  const groups: Record<string, Market[]> = {}
  const ungrouped: Market[] = []

  otherMarkets.forEach((m) => {
    if (isFinance && m.coin) {
      const section = FINANCE_CATEGORY_MAP[m.coin] ?? 'Sonstige'
      if (!financeSections[section]) financeSections[section] = []
      financeSections[section].push(m)
    } else if (m.group_title) {
      if (!groups[m.group_title]) groups[m.group_title] = []
      groups[m.group_title].push(m)
    } else if (m.display_group) {
      if (!groups[`__dg__${m.display_group}`]) groups[`__dg__${m.display_group}`] = []
      groups[`__dg__${m.display_group}`].push(m)
    } else {
      ungrouped.push(m)
    }
  })

  return (
    <div>
      {/* ── Wetter: immer Einzelkarten ── */}
      {weatherMarkets.length > 0 && (
        <div className="markets-grid" style={{ marginBottom: 24 }}>
          {weatherMarkets.map(m => <WeatherMarketCard key={m.id} market={m} onClick={() => onOpen(m.id)} />)}
        </div>
      )}

      {soccerEntries.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {Object.entries(soccerByDate).map(([dateKey, matches]) => (
            <div key={dateKey} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>{dateKey}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {matches.map(([matchId, matchMarkets]) => (<SoccerMatchCard key={matchId} markets={matchMarkets} onOpen={onOpen} />))}
              </div>
            </div>
          ))}
        </div>
      )}

      {isFinance ? (
        <>
          {FINANCE_SECTION_ORDER.map(section => {
            const sectionMarkets = financeSections[section]
            if (!sectionMarkets || sectionMarkets.length === 0) return null
            return (
              <div key={section} style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{section}</div>
                <div className="markets-grid">{sectionMarkets.map(m => <MarketCard key={m.id} market={m} onClick={() => onOpen(m.id)} />)}</div>
              </div>
            )
          })}
        </>
      ) : (
        <>
          {ungrouped.length > 0 && (<div className="markets-grid">{ungrouped.map((m) => <MarketCard key={m.id} market={m} onClick={() => onOpen(m.id)} />)}</div>)}
          {Object.entries(groups).map(([key, mts]) => {
            const isDisplay = key.startsWith('__dg__')
            const label = isDisplay ? key.replace('__dg__', '') : key
            const isMultiOutcome = !isDisplay && mts.length > 2
            if (isMultiOutcome) {
              const rawProbs = mts.map(m => calcProb(m.q_yes, m.q_no, m.b))
              const totalProb = rawProbs.reduce((s, p) => s + p, 0) || 1
              const normalizedProbs = rawProbs.map(p => Math.round((p / totalProb) * 100))
              const sortedWithProbs = mts.map((m, i) => ({ m, normProb: normalizedProbs[i] })).sort((a, b) => b.normProb - a.normProb)
              const totalVol = mts.reduce((s, m) => s + m.q_yes + m.q_no, 0)
              return (
                <div key={key} style={{ marginBottom: 32 }}>
                  <div style={{ background: '#1a1f2e', borderRadius: '12px 12px 0 0', padding: '14px 20px' }}><div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{label}</div></div>
                  <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                    {sortedWithProbs.map(({ m, normProb }, i) => {
                      const isTop = i === 0
                      return (
                        <div key={m.id} onClick={() => onOpen(m.id)} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 80px 180px', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: 'var(--card)', borderBottom: i < sortedWithProbs.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>{i + 1}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: isTop ? 700 : 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.short_label ?? m.question}</div>
                            <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}><div style={{ width: `${normProb}%`, height: '100%', background: isTop ? '#6366f1' : 'var(--text-muted)', borderRadius: 2, transition: 'width 0.3s' }} /></div>
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: isTop ? '#6366f1' : 'var(--text)', textAlign: 'right' }}>{normProb}%</div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={e => { e.stopPropagation(); onOpen(m.id) }} style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', background: 'rgba(22,163,74,0.12)', color: '#16a34a', cursor: 'pointer' }}>Ja {normProb}%</button>
                            <button onClick={e => { e.stopPropagation(); onOpen(m.id) }} style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', background: 'rgba(220,38,38,0.10)', color: '#dc2626', cursor: 'pointer' }}>Nein {100 - normProb}%</button>
                          </div>
                        </div>
                      )
                    })}
                    <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', display: 'flex', gap: 16 }}><span>{mts.length} Optionen</span><span>{Math.round(totalVol).toLocaleString('de')} ₫ Volumen</span></div>
                  </div>
                </div>
              )
            }
            return (
              <div key={key}>
                <div className={isDisplay ? 'display-group-header' : 'group-header'}>{label}</div>
                <div className="markets-grid">{mts.map((m) => <MarketCard key={m.id} market={m} onClick={() => onOpen(m.id)} />)}</div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

interface LiveGoal { matchMinute: number; goalGetterName: string; scoreTeam1: number; scoreTeam2: number; isOwnGoal: boolean }
interface LiveMatchData { score: { home: number; away: number } | null; goals: LiveGoal[]; isLive: boolean; minute: number | null }

function SoccerMatchCard({ markets, onOpen }: { markets: Market[]; onOpen: (id: string) => void }) {
  const homeMarket = markets.find(m => m.outcome === 'home')
  const drawMarket = markets.find(m => m.outcome === 'draw')
  const awayMarket = markets.find(m => m.outcome === 'away')
  const [liveData, setLiveData] = useState<LiveMatchData | null>(null)
  const anyMarket = homeMarket ?? drawMarket ?? awayMarket
  if (!anyMarket) return null
  const matchIdNum = anyMarket.match_id?.replace('bl1-', '')
  const closesAtMs = parseUTC(anyMarket.closes_at).getTime()
  const now = Date.now()
  const matchStartMs = closesAtMs - 115 * 60 * 1000
  const isOngoing = now >= matchStartMs && now <= closesAtMs + 30 * 60 * 1000

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!matchIdNum || !isOngoing) return
    const fetchLive = async () => {
      try {
        const season = new Date().getMonth() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1
        const res = await fetch(`https://api.openligadb.de/getmatchdata/bl1/${season}`, { cache: 'no-store' })
        if (!res.ok) return
        const all = await res.json()
        const match = all.find((m: { matchID: number }) => String(m.matchID) === matchIdNum)
        if (!match) return
        const goals: LiveGoal[] = (match.goals ?? []).map((g: { matchMinute: number; goalGetterName: string; scoreTeam1: number; scoreTeam2: number; isOwnGoal: boolean }) => ({ matchMinute: g.matchMinute, goalGetterName: g.goalGetterName, scoreTeam1: g.scoreTeam1, scoreTeam2: g.scoreTeam2, isOwnGoal: g.isOwnGoal }))
        const final = match.matchResults?.find((r: { resultTypeID: number }) => r.resultTypeID === 2)
        const ht    = match.matchResults?.find((r: { resultTypeID: number }) => r.resultTypeID === 1)
        const score = final ? { home: final.pointsTeam1, away: final.pointsTeam2 } : ht ? { home: ht.pointsTeam1, away: ht.pointsTeam2 } : null
        setLiveData({ score, goals, isLive: !match.matchIsFinished && goals.length > 0, minute: null })
      } catch {}
    }
    fetchLive()
    const id = setInterval(fetchLive, 60000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchIdNum, isOngoing])

  const displayGroup = anyMarket.display_group ?? ''
  const teams = displayGroup.split(' vs ')
  const homeTeam = teams[0] ?? ''; const awayTeam = teams[1] ?? ''
  const homeProb = homeMarket ? calcProb(homeMarket.q_yes, homeMarket.q_no, homeMarket.b) : 33
  const drawProb = drawMarket ? calcProb(drawMarket.q_yes, drawMarket.q_no, drawMarket.b) : 34
  const awayProb = awayMarket ? calcProb(awayMarket.q_yes, awayMarket.q_no, awayMarket.b) : 33
  const total = homeProb + drawProb + awayProb
  const homeNorm = Math.round((homeProb / total) * 100); const drawNorm = Math.round((drawProb / total) * 100); const awayNorm = 100 - homeNorm - drawNorm
  const timePart = anyMarket.match_date ?? ''
  const totalVolume = markets.reduce((s, m) => s + m.q_yes + m.q_no, 0)
  const homeColor = getTeamColor(homeTeam); const awayColor = getTeamColor(awayTeam)
  const hasLive = liveData && (liveData.score || liveData.goals.length > 0)
  const lastGoals = liveData?.goals.slice(-3).reverse() ?? []

  return (
    <div className="market-card" style={{ padding: '14px 18px', cursor: 'pointer' }} onClick={() => onOpen((homeMarket ?? anyMarket).id)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Bundesliga</span>
          {timePart && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {timePart} Uhr</span>}
          {totalVolume > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {Math.round(totalVolume).toLocaleString('de')} ₫</span>}
          {liveData?.isLive && (<span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#22c55e' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />LIVE</span>)}
        </div>
        <div className="live-dot" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <TeamLogo teamName={homeTeam} color={homeColor} size={40} />
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{homeTeam}</div><div style={{ fontSize: 20, fontWeight: 800, color: homeColor, lineHeight: 1.1 }}>{homeNorm}¢</div></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0, padding: '0 8px' }}>
          {hasLive && liveData.score ? (<><div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1 }}>{liveData.score.home} : {liveData.score.away}</div><div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5 }}>STAND</div></>) : (<><div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5 }}>DRAW</div><div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)' }}>{drawNorm}¢</div></>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 0, textAlign: 'right' }}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{awayTeam}</div><div style={{ fontSize: 20, fontWeight: 800, color: awayColor, lineHeight: 1.1 }}>{awayNorm}¢</div></div>
          <TeamLogo teamName={awayTeam} color={awayColor} size={40} />
        </div>
      </div>
      {lastGoals.length > 0 && (<div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>{lastGoals.map((g, i) => (<div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 10 }}>⚽</span><span style={{ fontWeight: 600 }}>{g.matchMinute}&apos;</span><span>{g.goalGetterName}{g.isOwnGoal ? ' (ET)' : ''}</span><span style={{ color: 'var(--text-subtle)', marginLeft: 'auto' }}>{g.scoreTeam1}:{g.scoreTeam2}</span></div>))}</div>)}
      <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', gap: 2, marginTop: 12 }}>
        <div style={{ width: `${homeNorm}%`, background: homeColor }} /><div style={{ width: `${drawNorm}%`, background: '#94a3b8' }} /><div style={{ width: `${awayNorm}%`, background: awayColor }} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        {[{ label: homeTeam.split(' ').slice(-1)[0], id: homeMarket?.id, color: homeColor }, { label: 'Draw', id: drawMarket?.id, color: '#64748b' }, { label: awayTeam.split(' ').slice(-1)[0], id: awayMarket?.id, color: awayColor }].map((btn) => btn.id ? (
          <button key={btn.id} onClick={(e) => { e.stopPropagation(); onOpen(btn.id!) }} style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: '7px 0', borderRadius: 8, border: `1px solid ${btn.color}44`, background: `${btn.color}18`, color: btn.color, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{btn.label}</button>
        ) : null)}
      </div>
    </div>
  )
}

function MarketCard({ market, onClick }: { market: Market; onClick: () => void }) {
  const prob     = calcProb(market.q_yes, market.q_no, market.b)
  const isLow    = prob < 50
  const catClass = CAT_CLASS[market.category ?? ''] ?? ''
  return (
    <div className="market-card" onClick={onClick}>
      <div className="market-card-meta">
        {market.category && <span className={`cat-badge ${catClass}`}>{market.category === 'finance' ? 'FINANZEN' : market.category}</span>}
        {market.is_auto && <div className="live-dot" title="Live" />}
      </div>
      <div className="market-card-question">{market.short_label ?? market.question}</div>
      <div className="prob-bar"><div className={`prob-bar-fill ${isLow ? 'low' : ''}`} style={{ width: `${prob}%` }} /></div>
      <div className="market-card-footer">
        <div className={`market-prob ${isLow ? 'low' : ''}`}>{prob}%</div>
        <div className="market-volume">{Math.round(market.q_yes + market.q_no)} ₫ Vol.</div>
      </div>
      <div className="bet-btns">
        <button className="btn-yes" onClick={(e) => { e.stopPropagation(); onClick() }}>Ja {prob}%</button>
        <button className="btn-no" onClick={(e) => { e.stopPropagation(); onClick() }}>Nein {100 - prob}%</button>
      </div>
    </div>
  )
}

function PortfolioView({ userId, router }: { userId: string; router: ReturnType<typeof useRouter> }) {
  interface Position { market_id: string; direction: string; amount: number; question: string; q_yes: number; q_no: number; b: number; resolved: boolean; resolution?: string }
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading]     = useState(true)
  useEffect(() => {
    dbGet('positions', `user_id=eq.${userId}&select=*`).then(async (posData) => {
      if (!posData || posData.length === 0) { setLoading(false); return }
      const ids = posData.map((p: { market_id: string }) => p.market_id).join(',')
      const mktData = await dbGet('markets', `id=in.(${ids})&select=id,question,q_yes,q_no,b,resolved,resolution`)
      const mktMap: Record<string, Market> = {}
      mktData?.forEach((m: Market) => { mktMap[m.id] = m })
      setPositions(posData.map((p: { market_id: string; direction: string; amount: number }) => ({ ...p, ...mktMap[p.market_id] })))
      setLoading(false)
    })
  }, [userId])

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '24px 0' }}>manifesting results...</div>
  if (positions.length === 0) return (<div className="card" style={{ textAlign: 'center', padding: 32 }}><div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Noch keine Positionen.</div><div style={{ fontSize: 13, color: 'var(--text-subtle)' }}>Platziere deine erste Wette auf einen Markt.</div></div>)

  return (
    <div>
      <div className="section-head"><div className="section-title">Mein Portfolio</div></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {positions.map((p, i) => {
          const prob = calcProb(p.q_yes, p.q_no, p.b); const isYes = p.direction === 'yes'; const isWin = p.resolution === p.direction
          return (
            <div key={i} className="card" style={{ cursor: 'pointer' }} onClick={() => router.push(`/markets/${p.market_id}`)}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: 'var(--text)' }}>{p.question}</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)' }}>Position: <strong style={{ color: isYes ? 'var(--yes)' : 'var(--no)' }}>{isYes ? 'JA' : 'NEIN'}</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>Einsatz: <strong>{p.amount} ₫</strong></span>
                <span style={{ color: 'var(--text-muted)' }}>Aktuell: <strong>{prob}%</strong></span>
                {p.resolved && (<span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: isWin ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)', color: isWin ? '#16a34a' : '#ef4444', letterSpacing: 0.5 }}>{isWin ? 'Gewonnen' : 'Verloren'}</span>)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
