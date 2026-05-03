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

interface WinToast {
  id: string
  coin?: string
  question: string
  amount: number
  isKrypto: boolean
  direction: 'yes' | 'no'
}

function calcProb(qYes: number, qNo: number, b: number): number {
  const eYes = Math.exp(qYes / b)
  const eNo  = Math.exp(qNo  / b)
  return Math.round((eYes / (eYes + eNo)) * 100)
}

const CATEGORIES = ['Alle', 'Politik', 'Sport', 'Krypto', 'Entertainment', 'Wirtschaft']

const CAT_CLASS: Record<string, string> = {
  Politik:       'cat-politik',
  Sport:         'cat-sport',
  Krypto:        'cat-krypto',
  Entertainment: 'cat-entertainment',
  Wirtschaft:    'cat-wirtschaft',
}

const COIN_COLORS: Record<string, string> = {
  BTC: '#f59e0b', ETH: '#6366f1', SOL: '#9945ff', XRP: '#00aae4',
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

type AuthMode = 'login' | 'register'

export default function Home() {
  const router = useRouter()
  const [markets, setMarkets]           = useState<Market[]>([])
  const [user, setUser]                 = useState<User | null>(null)
  const [leaderboard, setLeaderboard]   = useState<LeaderboardEntry[]>([])
  const [category, setCategory]         = useState('Alle')
  const [view, setView]                 = useState<'markets' | 'portfolio' | 'admin' | 'profil'>('markets')
  const [loading, setLoading]           = useState(true)
  const [darkMode, setDarkMode]         = useState(false)
  const [showAuth, setShowAuth]         = useState(false)
  const [authMode, setAuthMode]         = useState<AuthMode>('login')
  const [authEmail, setAuthEmail]       = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authUsername, setAuthUsername] = useState('')
  const [authError, setAuthError]       = useState('')
  const [authLoading, setAuthLoading]   = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')
  const [winToasts, setWinToasts]       = useState<WinToast[]>([])
  const shownToastsRef                  = useRef<Set<string>>(new Set())
  const userRef                         = useRef<User | null>(null)

  const ADMIN_ID = 'b75edaf4-141d-41f1-9555-887a8ddbac58'

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
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

  const loadMarkets = useCallback(async () => {
    setLoading(true)
    const data = await dbGet('markets', 'status=eq.open&select=*&order=created_at.desc')
    setMarkets(data ?? [])
    setLoading(false)
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

  useEffect(() => {
    loadMarkets()
    loadLeaderboard()
  }, [loadMarkets, loadLeaderboard])

  const checkWins = useCallback(async (userId: string) => {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const trades = await dbGet('trades', `user_id=eq.${userId}&type=in.(buy_yes,buy_no)&created_at=gte.${since}&select=market_id,type,shares`)
    if (!trades || trades.length === 0) return

    const seen: Record<string, boolean> = {}
    const marketIds: string[] = []
    trades.forEach((t: { market_id: string }) => {
      if (!seen[t.market_id]) { seen[t.market_id] = true; marketIds.push(t.market_id) }
    })

    const resolvedMarkets = await dbGet('markets', `id=in.(${marketIds.join(',')})&resolved=eq.true&select=id,question,resolution,is_auto,coin`)
    if (!resolvedMarkets || resolvedMarkets.length === 0) return

    const newToasts: WinToast[] = []

    for (const market of resolvedMarkets) {
      if (shownToastsRef.current.has(market.id)) continue
      const marketTrades = trades.filter((t: { market_id: string; type: string; shares: number }) => t.market_id === market.id)
      const wonTrades = marketTrades.filter((t: { type: string }) =>
        (market.resolution === 'yes' && t.type === 'buy_yes') ||
        (market.resolution === 'no'  && t.type === 'buy_no')
      )
      if (wonTrades.length === 0) continue
      const totalShares = wonTrades.reduce((s: number, t: { shares: number }) => s + (t.shares ?? 0), 0)
      const amount = Math.round(totalShares)
      if (amount <= 0) continue
      shownToastsRef.current.add(market.id)
      newToasts.push({
        id: market.id,
        coin: market.coin,
        question: market.question,
        amount,
        isKrypto: !!market.is_auto,
        direction: market.resolution as 'yes' | 'no',
      })
    }

    if (newToasts.length > 0) {
      setWinToasts(prev => [...prev, ...newToasts])
      const freshUser = await dbGet('users', `id=eq.${userId}&select=balance`)
      if (freshUser?.[0]) {
        setUser(prev => prev ? { ...prev, balance: freshUser[0].balance } : prev)
        userRef.current = { ...userRef.current!, balance: freshUser[0].balance }
      }
      newToasts.forEach(toast => {
        setTimeout(() => {
          setWinToasts(prev => prev.filter(t => t.id !== toast.id))
        }, 6000)
      })
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
      setUser(userData[0])
      userRef.current = userData[0]
      localStorage.setItem('mobius_session', JSON.stringify({ access_token: res.access_token, user_id: userId }))
      setShowAuth(false)
      resetAuthForm()
    } else {
      setAuthError('Benutzer nicht gefunden.')
    }
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
      setUser(userData[0])
      userRef.current = userData[0]
      localStorage.setItem('mobius_session', JSON.stringify({ access_token: token, user_id: userId }))
      setShowAuth(false)
      resetAuthForm()
      loadLeaderboard()
    } else {
      setAuthError('Konto erstellt! Bitte melde dich jetzt an.')
    }
  }

  const handleLogout = () => {
    setUser(null)
    userRef.current = null
    localStorage.removeItem('mobius_session')
    setView('markets')
    setWinToasts([])
    shownToastsRef.current = new Set()
  }

  const resetAuthForm = () => {
    setAuthEmail('')
    setAuthPassword('')
    setAuthUsername('')
    setAuthError('')
  }

  const openAuth = (mode: AuthMode) => {
    resetAuthForm()
    setAuthMode(mode)
    setShowAuth(true)
  }

  const filteredMarkets = markets.filter((m) => {
    const matchCat = category === 'Alle' || m.category === category
    const matchSearch = searchQuery === '' ||
      (m.question ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.short_label ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <>
      {/* ── Win Toasts ── */}
      <div style={{ position: 'fixed', top: 80, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
        {winToasts.map(toast => (
          <div key={toast.id} style={{
            pointerEvents: 'all',
            background: '#fff',
            border: '1px solid rgba(22,163,74,0.3)',
            borderLeft: '4px solid #16a34a',
            borderRadius: 12,
            padding: '14px 16px',
            minWidth: 260,
            maxWidth: 320,
            boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
            animation: 'slideInRight 0.3s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {toast.isKrypto && toast.coin && (
                  <span style={{ width: 24, height: 24, borderRadius: 6, background: COIN_COLORS[toast.coin] ?? '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {toast.coin.charAt(0)}
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>🎉 Gewonnen!</span>
              </div>
              <button onClick={() => setWinToasts(prev => prev.filter(t => t.id !== toast.id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af', padding: 0, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, lineHeight: 1.4 }}>
              {toast.isKrypto
                ? `${toast.coin} ${toast.direction === 'yes' ? 'Up ↑' : 'Down ↓'}`
                : toast.question.length > 50 ? toast.question.slice(0, 50) + '…' : toast.question}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a', letterSpacing: '-0.5px', lineHeight: 1 }}>
              +{toast.amount.toLocaleString('de')} ₫
            </div>
          </div>
        ))}
      </div>

      {/* ── Auth Modal ── */}
      {showAuth && (
        <div className="modal-backdrop" onClick={() => setShowAuth(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              {authMode === 'login' ? 'Anmelden' : 'Konto erstellen'}
            </div>
            <div className="auth-tabs">
              <button className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
                onClick={() => { setAuthMode('login'); setAuthError('') }}>Anmelden</button>
              <button className={`auth-tab ${authMode === 'register' ? 'active' : ''}`}
                onClick={() => { setAuthMode('register'); setAuthError('') }}>Registrieren</button>
            </div>
            {authMode === 'register' && (
              <input type="text" placeholder="Benutzername" value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                maxLength={50}
                style={{ width: '100%' }} />
            )}
            <input type="email" placeholder="E-Mail" value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              maxLength={254}
              style={{ width: '100%' }} autoFocus />
            <input type="password" placeholder="Passwort" value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              maxLength={128}
              onKeyDown={(e) => e.key === 'Enter' && (authMode === 'login' ? handleLogin() : handleRegister())}
              style={{ width: '100%' }} />
            {authError && <div className="alert alert-error">{authError}</div>}
            <button className="submit-btn yes" onClick={authMode === 'login' ? handleLogin : handleRegister}
              disabled={authLoading} style={{ marginTop: 4 }}>
              {authLoading ? 'Laden…' : authMode === 'login' ? 'Anmelden' : 'Konto erstellen'}
            </button>
            {authMode === 'register' && (
              <div style={{ fontSize: 12, color: 'var(--text-subtle)', textAlign: 'center' }}>
                Du startest mit 1.000 ₫ Dukaten.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Nav ── */}
      <nav className="nav">
        <div className="nav-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-weiss.png"
            alt="Möbius"
            className="nav-logo"
            onClick={() => { setView('markets'); setSearchQuery('') }}
          />
          <div className="nav-search-wrap">
            <span className="nav-search-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              className="nav-search"
              type="text"
              placeholder="Märkte durchsuchen…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setView('markets') }}
            />
          </div>
        </div>

        <div className="nav-right">
          {user ? (
            <>
              <div className="nav-stat">
                <div className="nav-stat-label">Guthaben</div>
                <div className="nav-stat-value">{user.balance.toLocaleString('de')} ₫</div>
              </div>
              <div className="nav-divider" />
              {user?.id === ADMIN_ID && (
                <button className="nav-pill" onClick={() => setView('admin')}
                  style={{ background: 'rgba(124,58,237,0.25)', borderColor: 'rgba(124,58,237,0.5)', color: '#c4b5fd' }}>
                  Admin
                </button>
              )}
            </>
          ) : (
            <>
              <button className="nav-pill" onClick={() => openAuth('login')}>Anmelden</button>
              <button className="nav-pill accent" onClick={() => openAuth('register')}>Registrieren</button>
            </>
          )}

          <button className="nav-icon-btn" onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Light Mode' : 'Dark Mode'}>
            {darkMode ? '☀️' : '🌙'}
          </button>

          {user && (
            <>
              <div className="nav-avatar" onClick={() => setView('profil')} title={user.username}>
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar_url} alt={user.username}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <span>{user.username.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <button className="nav-pill" onClick={handleLogout}>Abmelden</button>
            </>
          )}
        </div>
      </nav>

      {/* ── Kategorie-Leiste ── */}
      <div className="cat-bar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`cat-bar-btn ${category === cat ? 'active' : ''}`}
            onClick={() => { setCategory(cat); setView('markets') }}
          >
            {cat}
          </button>
        ))}
      </div>

      <main className="page-container">
        {view === 'admin' && user?.id === ADMIN_ID && (
          <AdminPanel userId={user.id} openMarkets={markets} onMarketResolved={loadMarkets} />
        )}
        {view === 'profil' && user && (
          <ProfileView
            userId={user.id}
            token={user.id}
            displayName={user.username}
            avatarUrl={user.avatar_url ?? ''}
            balance={user.balance}
            onUsernameChange={(name) => setUser({ ...user, username: name })}
            onAvatarChange={(url) => setUser({ ...user, avatar_url: url })}
          />
        )}
        {view === 'markets' && (
          <>
            {user && (
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Guthaben</div>
                  <div className="stat-value">{user.balance.toLocaleString('de')} ₫</div>
                  <div className="stat-delta delta-neu">Deine Dukaten</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Aktive Märkte</div>
                  <div className="stat-value">{markets.length}</div>
                  <div className="stat-delta delta-neu">offen</div>
                </div>
              </div>
            )}
            <div className="section-head">
              <div className="section-title">
                {searchQuery ? `Suche: „${searchQuery}"` : category === 'Alle' ? 'Alle Märkte' : category}
              </div>
              <div className="section-link" onClick={loadMarkets}>Aktualisieren</div>
            </div>
            {loading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '24px 0' }}>
                Märkte werden geladen…
              </div>
            ) : filteredMarkets.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '24px 0' }}>
                Keine Märkte gefunden.
              </div>
            ) : (
              <MarketsGrid
                markets={filteredMarkets}
                onOpen={(id) => router.push(`/markets/${id}`)}
              />
            )}
            <div className="section-head" style={{ marginTop: 32 }}>
              <div className="section-title">Bestenliste</div>
            </div>
            <Leaderboard entries={leaderboard} currentUserId={user?.id} />
          </>
        )}
        {view === 'portfolio' && user && (
          <PortfolioView userId={user.id} router={router} />
        )}
      </main>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

function MarketsGrid({ markets, onOpen }: { markets: Market[]; onOpen: (id: string) => void }) {
  const groups: Record<string, Market[]> = {}
  const ungrouped: Market[] = []

  markets.forEach((m) => {
    if (m.group_title) {
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
      {ungrouped.length > 0 && (
        <div className="markets-grid">
          {ungrouped.map((m) => (
            <MarketCard key={m.id} market={m} onClick={() => onOpen(m.id)} />
          ))}
        </div>
      )}
      {Object.entries(groups).map(([key, mts]) => {
        const isDisplay = key.startsWith('__dg__')
        const label = isDisplay ? key.replace('__dg__', '') : key
        return (
          <div key={key}>
            <div className={isDisplay ? 'display-group-header' : 'group-header'}>{label}</div>
            <div className="markets-grid">
              {mts.map((m) => (
                <MarketCard key={m.id} market={m} onClick={() => onOpen(m.id)} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MarketCard({ market, onClick }: { market: Market; onClick: () => void }) {
  const prob = calcProb(market.q_yes, market.q_no, market.b)
  const isLow = prob < 50
  const catClass = CAT_CLASS[market.category ?? ''] ?? ''

  return (
    <div className="market-card" onClick={onClick}>
      <div className="market-card-meta">
        {market.category && <span className={`cat-badge ${catClass}`}>{market.category}</span>}
        {market.is_auto && <div className="live-dot" title="Live" />}
      </div>
      <div className="market-card-question">{market.short_label ?? market.question}</div>
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

function Leaderboard({ entries, currentUserId }: { entries: LeaderboardEntry[]; currentUserId?: string }) {
  const rankClass = (i: number) => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''

  return (
    <div className="leaderboard">
      {entries.map((e, i) => {
        const initials = e.username.slice(0, 2).toUpperCase()
        const av = avatarColor(e.username)
        const isMe = e.user_id === currentUserId
        return (
          <div key={e.user_id} className="lb-row" style={isMe ? { background: 'var(--accent-light)' } : {}}>
            <div className={`lb-rank ${rankClass(i)}`}>{i + 1}</div>
            <div className="lb-avatar" style={{ background: av.bg, color: av.color }}>
              {e.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.avatar_url} alt={e.username}
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : initials}
            </div>
            <div className="lb-name">{e.username}{isMe && <span className="lb-badge">Du</span>}</div>
            <div className="lb-score">{e.total_balance.toLocaleString('de')} ₫</div>
          </div>
        )
      })}
    </div>
  )
}

function PortfolioView({ userId, router }: {
  userId: string
  router: ReturnType<typeof useRouter>
}) {
  interface Position {
    market_id: string
    direction: string
    amount: number
    question: string
    q_yes: number
    q_no: number
    b: number
    resolved: boolean
    resolution?: string
  }

  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dbGet('positions', `user_id=eq.${userId}&select=*`).then(async (posData) => {
      if (!posData || posData.length === 0) { setLoading(false); return }
      const ids = posData.map((p: { market_id: string }) => p.market_id).join(',')
      const mktData = await dbGet('markets', `id=in.(${ids})&select=id,question,q_yes,q_no,b,resolved,resolution`)
      const mktMap: Record<string, Market> = {}
      mktData?.forEach((m: Market) => { mktMap[m.id] = m })
      setPositions(posData.map((p: { market_id: string; direction: string; amount: number }) => ({
        ...p, ...mktMap[p.market_id],
      })))
      setLoading(false)
    })
  }, [userId])

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '24px 0' }}>Portfolio wird geladen…</div>

  if (positions.length === 0) return (
    <div className="card" style={{ textAlign: 'center', padding: 32 }}>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Noch keine Positionen.</div>
      <div style={{ fontSize: 13, color: 'var(--text-subtle)' }}>Platziere deine erste Wette auf einen Markt.</div>
    </div>
  )

  return (
    <div>
      <div className="section-head">
        <div className="section-title">Mein Portfolio</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {positions.map((p, i) => {
          const prob = calcProb(p.q_yes, p.q_no, p.b)
          const isYes = p.direction === 'yes'
          return (
            <div key={i} className="card" style={{ cursor: 'pointer' }}
              onClick={() => router.push(`/markets/${p.market_id}`)}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: 'var(--text)' }}>{p.question}</div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  Position: <strong style={{ color: isYes ? 'var(--yes)' : 'var(--no)' }}>{isYes ? 'Ja' : 'Nein'}</strong>
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Einsatz: <strong style={{ color: 'var(--text)' }}>{p.amount} ₫</strong>
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Aktuell: <strong style={{ color: 'var(--text)' }}>{prob}%</strong>
                </span>
                {p.resolved && (
                  <span className={`pos-badge ${p.resolution === p.direction ? 'pos-yes' : 'pos-no'}`}>
                    {p.resolution === p.direction ? 'Gewonnen' : 'Verloren'}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
