'use client'

import { useEffect, useState, useCallback, useRef, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  AppShellContext,
  ADMIN_ID,
  User,
  ViewType,
  MobileTab,
  AuthMode,
} from './AppShellContext'
import { Icon, PillIcon } from './Icons'

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

function calcProb(qYes: number, qNo: number, b: number): number {
  const eYes = Math.exp(qYes / b)
  const eNo  = Math.exp(qNo  / b)
  return Math.round((eYes / (eYes + eNo)) * 100)
}

interface LeaderboardEntry {
  user_id: string
  username: string
  total_balance: number
  avatar_url?: string
  title?: string
}

interface WeeklyEntry {
  user_id: string
  username: string
  weekly_gain: number
  avatar_url?: string
  title?: string
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

interface LoginBonusToast {
  amount: number
  isBankrupt: boolean
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

const COIN_COLORS: Record<string, string> = {
  BTC: '#f59e0b', ETH: '#6366f1', SOL: '#9945ff', XRP: '#00aae4',
}

function RankBadge({ rank }: { rank: number }) {
  const isFirst = rank === 1
  return (
    <span style={{
      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700,
      background: isFirst ? 'var(--amber-light)' : 'var(--surface)',
      color: isFirst ? 'var(--amber)' : 'var(--text-muted)',
      border: isFirst ? 'none' : '1px solid var(--border)',
    }}>
      {rank}
    </span>
  )
}

interface NavItemDef {
  id: string
  href: string
  label: string
  icon?: string
  flag?: string
  children?: NavItemDef[]
}

// href ist der Pfad ohne führenden Slash (siehe app/[...category]/page.tsx CATEGORY_MAP).
// Jeder Eintrag ist jetzt eine echte, eigenständige URL — parentOnly entfällt, da auch
// die vormals reinen Toggle-Einträge (Politik, Finanzen) selbst navigierbare Seiten sind.
const NAV_ITEMS: NavItemDef[] = [
  { id: 'Politik', href: 'politik', label: 'Politik', icon: 'building-bank', children: [
    { id: 'Politik-Deutschland', href: 'politik/deutschland', label: 'Deutschland', flag: 'DE' },
    { id: 'Politik-USA',        href: 'politik/usa',          label: 'USA',         flag: 'US' },
  ]},
  { id: 'Sport', href: 'sport', label: 'Sport', icon: 'ball-football', children: [
    { id: 'Fußball', href: 'sport/fussball', label: 'Fußball', icon: 'ball-football', children: [
      { id: 'Bundesliga', href: 'sport/bundesliga', label: 'Bundesliga', flag: 'DE' },
    ]},
    { id: 'F1', href: 'sport/f1', label: 'Formel 1', icon: 'steering-wheel' },
  ]},
  { id: 'Krypto',        href: 'krypto',        label: 'Krypto',        icon: '₿'  },
  { id: 'Entertainment', href: 'entertainment', label: 'Entertainment', icon: 'movie' },
  { id: 'Wirtschaft',    href: 'wirtschaft',    label: 'Wirtschaft',    icon: 'chart-line' },
  { id: 'Tech',          href: 'tech',          label: 'Tech',          icon: 'device-laptop' },
  { id: 'Geopolitik',    href: 'geopolitik',    label: 'Geopolitik',    icon: 'world' },
  { id: 'Finanzen', href: 'finanzen', label: 'Finanzen', icon: 'wallet', children: [
    { id: 'Finanzen-Tag',   href: 'finanzen/tag',   label: 'Aktueller Handelstag',  icon: 'calendar' },
    { id: 'Finanzen-Woche', href: 'finanzen/woche', label: 'Aktuelle Handelswoche', icon: 'calendar-event' },
  ]},
  { id: 'Wetter',        href: 'wetter',        label: 'Wetter',        icon: 'cloud' },
  { id: 'Kultur',        href: 'kultur',         label: 'Kultur',        icon: 'ticket' },
]

// Dupliziert aus app/[...category]/page.tsx CATEGORY_MAP (nur Pfad -> categoryId).
// Bei Änderungen dort muss diese Map manuell synchron gehalten werden.
const PATH_TO_CATEGORY: Record<string, string> = {
  'politik':              'Politik-Deutschland',
  'politik/deutschland':  'Politik-Deutschland',
  'politik/usa':          'Politik-USA',
  'sport':                'Sport',
  'sport/fussball':       'Fußball',
  'sport/bundesliga':     'Bundesliga',
  'sport/f1':             'F1',
  'krypto':               'Krypto',
  'entertainment':        'Entertainment',
  'wirtschaft':           'Wirtschaft',
  'tech':                 'Tech',
  'geopolitik':           'Geopolitik',
  'finanzen':             'Finanzen-Tag',
  'finanzen/tag':         'Finanzen-Tag',
  'finanzen/woche':       'Finanzen-Woche',
  'wetter':               'Wetter',
  'kultur':               'Kultur',
}

// category ist jetzt kein State mehr, sondern wird bei jedem Render direkt aus der
// aktuellen URL abgeleitet — wichtig, da Navigation jetzt über echte <Link>-Klicks
// läuft (Client-Navigation ohne Remount), nicht mehr über setCategory().
function categoryFromPathname(pathname: string | null): string {
  if (!pathname) return 'Politik-Deutschland'
  const path = pathname.replace(/^\/+/, '').replace(/\/+$/, '')
  return PATH_TO_CATEGORY[path] ?? 'Politik-Deutschland'
}

const MOBILE_CAT_PILLS: { id: string; href: string; label: string; icon?: string; flag?: string }[] = [
  { id: 'Politik-Deutschland', href: 'politik/deutschland', label: 'Politik', flag: 'DE' },
  { id: 'Bundesliga',          href: 'sport/bundesliga',    label: 'Fußball', icon: 'ball-football' },
  { id: 'Krypto',              href: 'krypto',              label: 'Krypto',  icon: '₿'  },
  { id: 'Wirtschaft',          href: 'wirtschaft',          label: 'Wirtschaft', icon: 'chart-line' },
  { id: 'Finanzen-Tag',        href: 'finanzen/tag',        label: 'Finanzen', icon: 'wallet' },
  { id: 'Wetter',              href: 'wetter',              label: 'Wetter',  icon: 'cloud' },
  { id: 'Entertainment',       href: 'entertainment',       label: 'Entertainment', icon: 'movie' },
  { id: 'Tech',                href: 'tech',                label: 'Tech',    icon: 'device-laptop' },
  { id: 'Geopolitik',          href: 'geopolitik',          label: 'Geopolitik', icon: 'world' },
  { id: 'F1',                  href: 'sport/f1',            label: 'Formel 1', icon: 'steering-wheel' },
  { id: 'Kultur',              href: 'kultur',               label: 'Kultur',  icon: 'ticket' },
]

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [user, setUser]                       = useState<User | null>(null)
  const [darkMode, setDarkMode]               = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('mobius_darkmode') === 'true'
  })
  const [view, setView]                       = useState<ViewType>('markets')
  const [mobileTab, setMobileTab]             = useState<MobileTab>('markets')
  const category                              = categoryFromPathname(pathname)
  // Initialwert kommt aus der URL (?q=...), analog zum bestehenden ?view=-Deep-Link-Muster
  // weiter unten — dadurch überlebt eine Suche einen Reload und ist teilbar.
  const [searchQuery, setSearchQuery]         = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('q') ?? ''
  })

  const [leaderboard, setLeaderboard]         = useState<LeaderboardEntry[]>([])
  const [weeklyBoard, setWeeklyBoard]         = useState<WeeklyEntry[]>([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const [showAuth, setShowAuth]               = useState(false)
  const [authMode, setAuthMode]               = useState<AuthMode>('login')
  const [authEmail, setAuthEmail]             = useState('')
  const [authPassword, setAuthPassword]       = useState('')
  const [authUsername, setAuthUsername]       = useState('')
  const [authError, setAuthError]             = useState('')
  const [authLoading, setAuthLoading]         = useState(false)

  const [winToasts, setWinToasts]             = useState<WinToast[]>([])
  const [loginBonusToast, setLoginBonusToast] = useState<LoginBonusToast | null>(null)
  const [expandedNav, setExpandedNav]         = useState<Record<string, boolean>>({ Sport: true, Fußball: true, Politik: true })

  const shownToastsRef                        = useRef<Set<string>>(new Set())
  const userRef                               = useRef<User | null>(null)

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

  const loadLeaderboard = useCallback(async () => {
    const data = await dbGet('users', 'select=id,username,balance,avatar_url,title&order=balance.desc&limit=10')
    setLeaderboard(
      (data ?? []).map((u: User) => ({
        user_id: u.id,
        username: u.username,
        total_balance: u.balance,
        avatar_url: u.avatar_url,
        title: u.title,
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
    const users = await dbGet('users', `id=in.(${topIds.join(',')})&select=id,username,avatar_url,title`)
    const userMap: Record<string, { username: string; avatar_url?: string; title?: string }> = {}
    users?.forEach((u: { id: string; username: string; avatar_url?: string; title?: string }) => {
      userMap[u.id] = { username: u.username, avatar_url: u.avatar_url, title: u.title }
    })
    setWeeklyBoard(topIds.map(id => ({
      user_id: id,
      username: userMap[id]?.username ?? 'Unbekannt',
      weekly_gain: Math.round(gainMap[id]),
      avatar_url: userMap[id]?.avatar_url,
      title: userMap[id]?.title,
    })))
  }, [])

  useEffect(() => {
    loadLeaderboard()
  }, [loadLeaderboard])

  // Deep-Link Support: ?view=portfolio|ranking|profil (z. B. von der Marktdetailseite aus)
  useEffect(() => {
    const viewParam = new URLSearchParams(window.location.search).get('view')
    if (viewParam === 'portfolio') {
      setView('portfolio'); setMobileTab('portfolio')
    } else if (viewParam === 'profil') {
      setView('profil'); setMobileTab('profil')
    } else if (viewParam === 'ranking') {
      setMobileTab('ranking'); loadWeeklyBoard(); setShowLeaderboard(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Suche auf ?q= synchronisieren. Bewusst history.replaceState() statt router.push/replace():
  // page.tsx/[...category]/page.tsx nutzen cache: 'no-store' für den Supabase-Fetch — eine
  // Router-Navigation würde bei jedem Tastendruck einen neuen Server-Fetch auslösen, obwohl
  // die Suche rein clientseitig in HomeClient (filteredMarkets) läuft. replaceState ändert
  // nur die sichtbare URL, ohne Next.js' Routing/Server-Fetch zu triggern.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (searchQuery) {
      url.searchParams.set('q', searchQuery)
    } else {
      url.searchParams.delete('q')
    }
    window.history.replaceState(null, '', url.pathname + url.search)
  }, [searchQuery])

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
      fetch('/api/login-xp', { method: 'POST', headers: { Authorization: `Bearer ${res.access_token}` } })
        .then(r => r.json())
        .then((data) => {
          if (data?.alreadyAwarded) return
          if (typeof data?.newBalance === 'number') {
            setUser(prev => prev ? { ...prev, balance: data.newBalance } : prev)
            userRef.current = userRef.current ? { ...userRef.current, balance: data.newBalance } : userRef.current
          }
          if (typeof data?.dukatenGain === 'number') {
            setLoginBonusToast({ amount: data.dukatenGain, isBankrupt: !!data.isBankrupt })
            setTimeout(() => setLoginBonusToast(null), 7000)
          }
        })
        .catch(() => {})
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

  const logout = () => {
    setUser(null); userRef.current = null
    localStorage.removeItem('mobius_session')
    setView('markets'); setMobileTab('markets'); setWinToasts([]); shownToastsRef.current = new Set()
    setLoginBonusToast(null)
  }

  const resetAuthForm = () => { setAuthEmail(''); setAuthPassword(''); setAuthUsername(''); setAuthError('') }
  const openAuth = (mode: AuthMode) => { resetAuthForm(); setAuthMode(mode); setShowAuth(true) }

  // Reset von view/mobileTab/searchQuery bei Kategorie-Navigation — läuft jetzt über
  // echte <Link>-Klicks (siehe NavItem/MOBILE_CAT_PILLS/Logo weiter unten), die diese
  // Funktion im onClick zusätzlich zur normalen Link-Navigation aufrufen.
  const handleNavClick = () => { setView('markets'); setMobileTab('markets'); setSearchQuery('') }
  // selectCategory bleibt in der AppShellContext-Schnittstelle erhalten (wird aktuell
  // von HomeClient's Finanzen-Subtabs genutzt), setzt aber keine Kategorie mehr —
  // die URL ist jetzt alleinige Quelle der Wahrheit dafür.
  const selectCategory = (_id: string) => handleNavClick()
  const toggleNav = (id: string) => setExpandedNav(prev => ({ ...prev, [id]: !prev[id] }))

  const handleMobileTab = (tab: MobileTab) => {
    setMobileTab(tab)
    if (tab === 'markets') setView('markets')
    else if (tab === 'portfolio') setView('portfolio')
    else if (tab === 'ranking') { loadWeeklyBoard(); setShowLeaderboard(true) }
    else if (tab === 'profil') {
      if (user) setView('profil')
      else openAuth('login')
    }
  }

  const contextValue = {
    user, setUser, logout,
    darkMode, setDarkMode,
    view, setView,
    mobileTab,
    category,
    searchQuery, setSearchQuery,
    selectCategory,
    openAuth,
  }

  return (
    <AppShellContext.Provider value={contextValue}>
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
        {loginBonusToast && (
          <div style={{ pointerEvents: 'all', background: 'var(--bg, #fff)', border: '1px solid rgba(99,102,241,0.3)', borderLeft: '4px solid #6366f1', borderRadius: 12, padding: '14px 16px', minWidth: 270, maxWidth: 330, boxShadow: '0 4px 24px rgba(0,0,0,0.12)', animation: 'slideInRight 0.3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', letterSpacing: 0.3 }}>
                {loginBonusToast.isBankrupt ? 'BANKROTT-HILFE' : 'DAILY BONUS'}
              </span>
              <button onClick={() => setLoginBonusToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af', padding: 0, lineHeight: 1 }}>×</button>
            </div>
            {loginBonusToast.isBankrupt && (
              <div style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)', marginBottom: 8, lineHeight: 1.4 }}>Dein Guthaben war unter 10 ₫. Hier ist ein Neustart.</div>
            )}
            <div style={{ fontSize: 26, fontWeight: 900, color: '#6366f1', letterSpacing: '-0.5px', lineHeight: 1 }}>+{loginBonusToast.amount.toLocaleString('de')} ₫</div>
          </div>
        )}
      </div>

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="modal-backdrop" onClick={() => setShowLeaderboard(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div className="modal-title" style={{ marginBottom: 2 }}>Wochenranking</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Top-Händler der letzten 7 Tage</div>
              </div>
              <button onClick={() => setShowLeaderboard(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
            </div>
            {weeklyBoard.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>Noch keine Daten für diese Woche.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {weeklyBoard.map((e, i) => {
                  const av = avatarColor(e.username)
                  const isMe = e.user_id === user?.id
                  return (
                    <div key={e.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: isMe ? 'var(--accent-light, rgba(99,102,241,0.08))' : 'var(--surface)', border: isMe ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent' }}>
                      <RankBadge rank={i + 1} />
                      {e.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.avatar_url} alt={e.username} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{e.username.slice(0, 2).toUpperCase()}</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: isMe ? 700 : 500, color: 'var(--text)', lineHeight: 1.2 }}>
                          {e.username}{isMe ? ' (du)' : ''}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.2 }}>
                          {e.title ?? 'Nadir'}
                        </div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', flexShrink: 0 }}>+{e.weekly_gain.toLocaleString('de')} ₫</span>
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
          <Link href="/politik/deutschland" onClick={handleNavClick} style={{ display: 'inline-flex' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-weiss.png" alt="Möbius" className="nav-logo" />
          </Link>
          <div className="nav-search-wrap">
            <span className="nav-search-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input className="nav-search" type="text" placeholder="Märkte durchsuchen…" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setView('markets'); setMobileTab('markets') }} />
          </div>
        </div>
        <div className="nav-right">
          {user ? (
            <>
              <button className="nav-pill" onClick={() => { loadWeeklyBoard(); setShowLeaderboard(true) }} style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                <Icon name="trophy" size={14} /><span>Ranking</span>
              </button>
              <div className="nav-stat"><div className="nav-stat-label">Guthaben</div><div className="nav-stat-value">{user.balance.toLocaleString('de')} ₫</div></div>
              <div className="nav-divider" />
              {user?.id === ADMIN_ID && (<button className="nav-pill" onClick={() => { setView('admin'); setMobileTab('markets') }} style={{ background: 'rgba(124,58,237,0.25)', borderColor: 'rgba(124,58,237,0.5)', color: '#c4b5fd' }}>Admin</button>)}
              <div className="nav-avatar" onClick={() => { setView('profil'); setMobileTab('profil') }} title={user.username}>
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar_url} alt={user.username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <span>{user.username.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <button className="nav-pill" onClick={logout}>Abmelden</button>
            </>
          ) : (
            <>
              <button className="nav-pill" onClick={() => openAuth('login')}>Anmelden</button>
              <button className="nav-pill accent" onClick={() => openAuth('register')}>Registrieren</button>
            </>
          )}
          <button className="nav-icon-btn" onClick={() => setDarkMode(!darkMode)}><Icon name={darkMode ? 'sun' : 'moon'} size={17} /></button>
        </div>
      </nav>

      {/* Mobile Category Pills */}
      <div className="mobile-cat-scroll">
        {MOBILE_CAT_PILLS.map(pill => {
          const href = `/${pill.href}`
          const isActive = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={pill.id}
              href={href}
              onClick={handleNavClick}
              className={`mobile-cat-pill ${isActive ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
            >
              <PillIcon icon={pill.icon} flag={pill.flag} size={14} /> {pill.label}
            </Link>
          )
        })}
      </div>

      {/* Layout */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - var(--nav-height, 56px))', maxWidth: 1400, margin: '0 auto' }}>

        {/* Desktop Sidebar */}
        <aside style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', padding: '20px 0', position: 'sticky', top: 'var(--nav-height, 56px)', height: 'calc(100vh - var(--nav-height, 56px))', overflowY: 'auto', background: 'var(--bg)' }}>
          {user && (<div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--border)', marginBottom: 12 }}><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Guthaben</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{user.balance.toLocaleString('de')} ₫</div></div>)}
          <div style={{ padding: '0 8px' }}>
            {NAV_ITEMS.map(item => (<NavItem key={item.id} item={item} pathname={pathname} expandedNav={expandedNav} onNavigate={handleNavClick} onToggle={toggleNav} depth={0} />))}
          </div>
          <div style={{ padding: '12px 8px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
            <a href="/about" className="nav-item-btn" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', padding: '8px 12px', borderRadius: 8 }}>
              <Icon name="bulb" size={16} />
              <span>About</span>
            </a>
            <a href="/faq" className="nav-item-btn" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', padding: '8px 12px', borderRadius: 8 }}>
              <Icon name="help" size={16} />
              <span>FAQ</span>
            </a>
            <a href="/raenge" className="nav-item-btn" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', padding: '8px 12px', borderRadius: 8 }}>
              <Icon name="star" size={16} />
              <span>Ränge</span>
            </a>
            <a href="/bewertungen" className="nav-item-btn" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', padding: '8px 12px', borderRadius: 8 }}>
              <Icon name="thumb-up" size={16} />
              <span>Bewertungen</span>
            </a>
          </div>
        </aside>

        <main style={{ flex: 1, minWidth: 0, padding: '24px 32px' }}>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="mobile-tab-bar">
        {[
          { id: 'markets',   label: 'Märkte',    icon: 'chart-bar' },
          { id: 'portfolio', label: 'Portfolio',  icon: 'briefcase' },
          { id: 'ranking',   label: 'Ranking',    icon: 'trophy' },
          { id: 'profil',    label: 'Profil',     icon: 'user' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`mobile-tab-item ${mobileTab === tab.id ? 'active' : ''}`}
            onClick={() => handleMobileTab(tab.id as MobileTab)}
          >
            <Icon name={tab.icon} size={20} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <style>{`
        @keyframes slideInRight { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .nav-item-btn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: none; background: transparent; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: var(--text-muted); text-align: left; transition: background 0.1s, color 0.1s; }
        .nav-item-btn:hover { background: var(--surface); color: var(--text); }
        .nav-item-btn.active { background: var(--accent-light, rgba(99,102,241,0.1)); color: var(--accent, #6366f1); font-weight: 700; }
        .nav-chevron { margin-left: auto; font-size: 10px; opacity: 0.5; transition: transform 0.2s; }
        .nav-chevron.open { transform: rotate(180deg); }
        @media (max-width: 768px) {
          .nav-right .nav-pill { display: none !important; }
          .nav-right .nav-icon-btn { display: none !important; }
          .nav-right .nav-divider { display: none !important; }
          .nav-right .nav-stat { display: none !important; }
        }
      `}</style>
    </AppShellContext.Provider>
  )
}

function NavItem({ item, pathname, expandedNav, onNavigate, onToggle, depth }: {
  item: NavItemDef; pathname: string; expandedNav: Record<string, boolean>
  onNavigate: () => void; onToggle: (id: string) => void; depth: number
}) {
  const hasChildren = !!item.children && item.children.length > 0
  const isExpanded   = expandedNav[item.id]
  const href         = `/${item.href}`
  const isActive     = pathname === href || pathname.startsWith(`${href}/`)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Link
          href={href}
          onClick={onNavigate}
          className={`nav-item-btn ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: 12 + depth * 12, flex: 1, width: 'auto', textDecoration: 'none' }}
        >
          <PillIcon icon={item.icon} flag={item.flag} size={15} />
          <span>{item.label}</span>
        </Link>
        {hasChildren && (
          <button
            onClick={() => onToggle(item.id)}
            aria-label={isExpanded ? 'Einklappen' : 'Ausklappen'}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 10px', color: 'var(--text-muted)' }}
          >
            <span className={`nav-chevron ${isExpanded ? 'open' : ''}`}>▼</span>
          </button>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div>{item.children!.map(child => (<NavItem key={child.id} item={child} pathname={pathname} expandedNav={expandedNav} onNavigate={onNavigate} onToggle={onToggle} depth={depth + 1} />))}</div>
      )}
    </div>
  )
}
