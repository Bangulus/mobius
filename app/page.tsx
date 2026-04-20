'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AdminPanel from './components/AdminPanel'
import ProfileView from './components/ProfileView'

const SUPABASE_URL = 'https://zrujclkigcrlrvpgxrqx.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydWpjbGtpZ2NybHJ2cGd4cnF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQ0NTEsImV4cCI6MjA5MTQwMDQ1MX0.JpuZxskptogAKtw5cUR3gJOAcnh3BFh1NSvfVEtN8IQ'

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    cache: 'no-store',
  })
  return res.json()
}

/* ─── Typen ──────────────────────────────────────────────────── */
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

/* ─── LMSR ───────────────────────────────────────────────────── */
function calcProb(qYes: number, qNo: number, b: number): number {
  const eYes = Math.exp(qYes / b)
  const eNo  = Math.exp(qNo  / b)
  return Math.round((eYes / (eYes + eNo)) * 100)
}

/* ─── Kategorien ─────────────────────────────────────────────── */
const CATEGORIES = ['Alle', 'Politik', 'Sport', 'Krypto', 'Entertainment', 'Wirtschaft']

const CAT_CLASS: Record<string, string> = {
  Politik:       'cat-politik',
  Sport:         'cat-sport',
  Krypto:        'cat-krypto',
  Entertainment: 'cat-entertainment',
  Wirtschaft:    'cat-wirtschaft',
}

/* ─── Avatar Farben ──────────────────────────────────────────── */
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

/* ─── Hauptkomponente ────────────────────────────────────────── */
export default function Home() {
  const router = useRouter()
  const [markets, setMarkets]         = useState<Market[]>([])
  const [user, setUser]               = useState<User | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [category, setCategory]       = useState('Alle')
  const [view, setView]               = useState<'markets' | 'portfolio' | 'admin' | 'profil'>('markets')
  const [loading, setLoading]         = useState(true)

  const ADMIN_ID = 'b75edaf4-141d-41f1-9555-887a8ddbac58'

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) return
    dbGet('users', `id=eq.${token}&select=*`).then((data) => {
      if (data?.[0]) setUser(data[0])
    })
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

  const filteredMarkets = markets.filter((m) =>
    category === 'Alle' || m.category === category
  )

  const token = user?.id ? `?token=${user.id}` : ''

  return (
    <>
      <nav className="nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="nav-logo">
            <div className="nav-logo-mark"><div className="nav-logo-inner" /></div>
            Möbius
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="nav-btn" onClick={() => setView('markets')}>Märkte</button>
          {user && (
            <button className="nav-btn" onClick={() => setView('portfolio')}>Portfolio</button>
          )}
          {user?.id === ADMIN_ID && (
            <button className="nav-btn" onClick={() => setView('admin')}
              style={{ background: 'rgba(124,58,237,0.2)', borderColor: 'rgba(124,58,237,0.4)' }}>
              Admin
            </button>
          )}
          {user ? (
            <div className="nav-avatar" onClick={() => setView('profil')} title={user.username}>
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt={user.username}
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                user.username.slice(0, 2).toUpperCase()
              )}
            </div>
          ) : (
            <button className="nav-btn accent">Anmelden</button>
          )}
        </div>
      </nav>

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
                  <div className="stat-label">Portfolio</div>
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
            <div className="pills">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={`pill ${category === cat ? 'active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="section-head">
              <div className="section-title">
                {category === 'Alle' ? 'Alle Märkte' : category}
              </div>
              <div className="section-link" onClick={loadMarkets}>Aktualisieren</div>
            </div>
            {loading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '24px 0' }}>
                Märkte werden geladen…
              </div>
            ) : filteredMarkets.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '24px 0' }}>
                Keine Märkte in dieser Kategorie.
              </div>
            ) : (
              <MarketsGrid
                markets={filteredMarkets}
                onOpen={(id) => router.push(`/markets/${id}${token}`)}
              />
            )}
            <div className="section-head" style={{ marginTop: 32 }}>
              <div className="section-title">Bestenliste</div>
            </div>
            <Leaderboard entries={leaderboard} currentUserId={user?.id} />
          </>
        )}
        {view === 'portfolio' && user && (
          <PortfolioView userId={user.id} token={token} router={router} />
        )}
      </main>
    </>
  )
}

/* ─── Märkte-Grid ────────────────────────────────────────────── */
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

/* ─── Einzelne Markt-Card ────────────────────────────────────── */
function MarketCard({ market, onClick }: { market: Market; onClick: () => void }) {
  const prob = calcProb(market.q_yes, market.q_no, market.b)
  const isLow = prob < 50
  const catClass = CAT_CLASS[market.category ?? ''] ?? ''

  return (
    <div className="market-card" onClick={onClick}>
      <div className="market-card-meta">
        {market.category && (
          <span className={`cat-badge ${catClass}`}>{market.category}</span>
        )}
        {market.is_auto && <div className="live-dot" title="Live" />}
      </div>
      <div className="market-card-question">
        {market.short_label ?? market.question}
      </div>
      <div className="prob-bar">
        <div className={`prob-bar-fill ${isLow ? 'low' : ''}`} style={{ width: `${prob}%` }} />
      </div>
      <div className="market-card-footer">
        <div className={`market-prob ${isLow ? 'low' : ''}`}>{prob}%</div>
        <div className="market-volume">{Math.round(market.q_yes + market.q_no)} ₫ Vol.</div>
      </div>
      <div className="bet-btns">
        <button className="btn-yes" onClick={(e) => { e.stopPropagation(); onClick() }}>
          Ja {prob}%
        </button>
        <button className="btn-no" onClick={(e) => { e.stopPropagation(); onClick() }}>
          Nein {100 - prob}%
        </button>
      </div>
    </div>
  )
}

/* ─── Leaderboard ────────────────────────────────────────────── */
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
            <div className="lb-name">
              {e.username}
              {isMe && <span className="lb-badge">Du</span>}
            </div>
            <div className="lb-score">{e.total_balance.toLocaleString('de')} ₫</div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Portfolio-Ansicht ──────────────────────────────────────── */
function PortfolioView({ userId, token, router }: {
  userId: string
  token: string
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
        ...p,
        ...mktMap[p.market_id],
      })))
      setLoading(false)
    })
  }, [userId])

  if (loading) return (
    <div style={{ color: 'var(--text-muted)', padding: '24px 0' }}>Portfolio wird geladen…</div>
  )

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
              onClick={() => router.push(`/markets/${p.market_id}${token}`)}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: 'var(--text)' }}>
                {p.question}
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  Position: <strong style={{ color: isYes ? 'var(--yes)' : 'var(--no)' }}>
                    {isYes ? 'Ja' : 'Nein'}
                  </strong>
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
