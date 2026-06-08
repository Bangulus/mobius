'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
        background: checked ? 'var(--accent)' : 'var(--border-md)',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s', padding: 0,
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: checked ? 21 : 3,
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

const PRIVACY_LABELS: { key: keyof PrivacySettings; label: string }[] = [
  { key: 'guthaben',               label: 'Guthaben' },
  { key: 'gewinn_verlust',         label: 'Gewinn / Verlust' },
  { key: 'groesster_gewinn',       label: 'Größter Gewinn' },
  { key: 'eingesetzt_gewonnen',    label: 'Eingesetzt & Gewonnen' },
  { key: 'offene_positionen',      label: 'Offene Positionen' },
  { key: 'lieblingskategorie',     label: 'Lieblingskategorie' },
  { key: 'durchschnittlicher_einsatz', label: 'Ø Einsatz' },
  { key: 'aktivitaet',             label: 'Aktivitäts-Feed' },
]

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const ADMIN_ID     = 'b75edaf4-141d-41f1-9555-887a8ddbac58'

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    cache: 'no-store',
  })
  return res.json()
}

async function dbPatch(table: string, params: string, body: object) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
}

interface ProfileUser {
  id: string
  username: string
  balance: number
  avatar_url?: string
  created_at?: string
  last_seen_at?: string
  privacy_settings?: PrivacySettings
}

interface PrivacySettings {
  guthaben: boolean
  gewinn_verlust: boolean
  groesster_gewinn: boolean
  eingesetzt_gewonnen: boolean
  streak: boolean
  offene_positionen: boolean
  aktivitaet: boolean
  lieblingskategorie: boolean
  durchschnittlicher_einsatz: boolean
}

const DEFAULT_PRIVACY: PrivacySettings = {
  guthaben: true,
  gewinn_verlust: true,
  groesster_gewinn: true,
  eingesetzt_gewonnen: true,
  streak: true,
  offene_positionen: true,
  aktivitaet: true,
  lieblingskategorie: true,
  durchschnittlicher_einsatz: true,
}

interface TradeRow {
  id: string
  market_id: string
  type: string
  shares: number
  cost: number
  created_at: string
}

interface MarketRow {
  id: string
  question: string
  resolved: boolean
  resolution?: string
  is_auto?: boolean
  coin?: string
  category?: string
}

interface PortfolioEntry {
  market: MarketRow
  einsatz: number
  direction: 'yes' | 'no'
  auszahlung: number | null
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

function formatLastSeen(iso?: string): string {
  if (!iso) return 'Unbekannt'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  const months = Math.floor(days / 30)
  if (diff < 86400000) return 'Heute'
  if (days === 1) return 'Vor einem Tag'
  if (days <= 30) return `Vor ${days} Tagen`
  if (months === 1) return 'Vor einem Monat'
  return `Vor ${months} Monaten`
}

function formatMemberSince(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
}

function calcStreak(trades: TradeRow[]): number {
  if (trades.length === 0) return 0
  const days = new Set(
    trades.map(t => {
      const d = new Date(t.created_at)
      return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
    })
  )
  let streak = 0
  const now = new Date()
  const check = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  while (true) {
    const key = `${check.getUTCFullYear()}-${check.getUTCMonth()}-${check.getUTCDate()}`
    if (!days.has(key)) break
    streak++
    check.setUTCDate(check.getUTCDate() - 1)
  }
  return streak
}

function calcTrefferquote(entries: PortfolioEntry[]): number | null {
  const resolved = entries.filter(e => e.market.resolved && e.market.resolution)
  if (resolved.length === 0) return null
  const correct = resolved.filter(e => e.market.resolution === e.direction).length
  return Math.round((correct / resolved.length) * 100)
}

function calcLieblingskategorie(markets: MarketRow[]): string | null {
  if (markets.length === 0) return null
  const counts: Record<string, number> = {}
  markets.forEach(m => {
    const cat = m.category ?? 'Sonstige'
    counts[cat] = (counts[cat] ?? 0) + 1
  })
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

const CAT_LABELS: Record<string, string> = {
  Politik: '🏛️ Politik', sport: '⚽ Fußball', Sport: '⚽ Fußball',
  Krypto: '₿ Krypto', Entertainment: '🎬 Entertainment',
  finance: '💰 Finanzen', Finanzen: '💰 Finanzen',
  weather: '🌤️ Wetter', formula1: '🏎️ Formel 1',
  Wirtschaft: '📈 Wirtschaft', Tech: '💻 Tech',
  Geopolitik: '🌍 Geopolitik', Kultur: '🎭 Kultur',
}

export default function PublicProfilePage() {
  const params   = useParams()
  const router   = useRouter()
  const username = decodeURIComponent(params.username as string)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [profileUser, setProfileUser]     = useState<ProfileUser | null>(null)
  const [trades, setTrades]               = useState<TradeRow[]>([])
  const [entries, setEntries]             = useState<PortfolioEntry[]>([])
  const [loading, setLoading]             = useState(true)
  const [notFound, setNotFound]           = useState(false)
  const [activeTab, setActiveTab]         = useState<'stats' | 'aktivitaet'>('stats')
  const [privacy, setPrivacy]             = useState<PrivacySettings>({ guthaben: true, gewinn_verlust: true, groesster_gewinn: true, eingesetzt_gewonnen: true, streak: true, offene_positionen: true, aktivitaet: true, lieblingskategorie: true, durchschnittlicher_einsatz: true })

  const isAdmin  = currentUserId === ADMIN_ID
  const isOwn    = currentUserId === profileUser?.id

  const togglePrivacy = async (key: keyof PrivacySettings) => {
    const updated = { ...privacy, [key]: !privacy[key] }
    setPrivacy(updated)
    await dbPatch('users', `id=eq.${currentUserId}`, { privacy_settings: updated })
  }

  // Session laden
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mobius_session')
      if (!saved) { router.push('/'); return }
      const session = JSON.parse(saved)
      if (!session?.user_id) { router.push('/'); return }
      setCurrentUserId(session.user_id)
    } catch { router.push('/') }
  }, [router])

  // last_seen_at des aktuellen Users updaten
  useEffect(() => {
    if (!currentUserId) return
    dbPatch('users', `id=eq.${currentUserId}`, { last_seen_at: new Date().toISOString() })
  }, [currentUserId])

  const loadProfile = useCallback(async () => {
    setLoading(true)
    const users = await dbGet('users', `username=eq.${encodeURIComponent(username)}&select=*`)
    if (!users?.[0]) { setNotFound(true); setLoading(false); return }
    const user: ProfileUser = users[0]
    setProfileUser(user)
    if (user.privacy_settings) {
      setPrivacy({ ...DEFAULT_PRIVACY, ...user.privacy_settings })
    }

    // Trades laden
    const rawTrades: TradeRow[] = await dbGet('trades', `user_id=eq.${user.id}&select=*&order=created_at.desc`)
    setTrades(rawTrades ?? [])

    // Märkte laden
    if (rawTrades?.length > 0) {
      const seen: Record<string, boolean> = {}
      const marketIds: string[] = []
      rawTrades.forEach(t => { if (!seen[t.market_id]) { seen[t.market_id] = true; marketIds.push(t.market_id) } })
      const markets: MarketRow[] = await dbGet('markets', `id=in.(${marketIds.join(',')})&select=id,question,resolved,resolution,is_auto,coin,category`)
      const marketMap: Record<string, MarketRow> = {}
      markets?.forEach(m => { marketMap[m.id] = m })

      const entryMap: Record<string, PortfolioEntry> = {}
      for (const trade of rawTrades) {
        const market = marketMap[trade.market_id]
        if (!market) continue
        const isBuy  = trade.type === 'buy_yes' || trade.type === 'buy_no'
        const isSell = trade.type === 'sell_yes' || trade.type === 'sell_no'
        const dir: 'yes' | 'no' = trade.type.includes('yes') ? 'yes' : 'no'
        if (!entryMap[trade.market_id]) {
          entryMap[trade.market_id] = { market, einsatz: 0, direction: dir, auszahlung: null }
        }
        const entry = entryMap[trade.market_id]
        if (isBuy)  { entry.einsatz += Math.abs(trade.cost); entry.direction = dir }
        if (isSell) { entry.auszahlung = (entry.auszahlung ?? 0) + Math.abs(trade.cost) }
      }
      for (const entry of Object.values(entryMap)) {
        const m = entry.market
        if (!m.resolved || entry.auszahlung !== null) continue
        const won = (m.resolution === 'yes' && entry.direction === 'yes') || (m.resolution === 'no' && entry.direction === 'no')
        if (won) {
          const mTrades = rawTrades.filter(t => t.market_id === m.id && (t.type === 'buy_yes' || t.type === 'buy_no'))
          entry.auszahlung = Math.round(mTrades.reduce((s, t) => s + (t.shares ?? 0), 0))
        } else {
          entry.auszahlung = 0
        }
      }
      setEntries(Object.values(entryMap))
    }
    setLoading(false)
  }, [username])

  useEffect(() => { if (currentUserId) loadProfile() }, [currentUserId, loadProfile])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Wird geladen…</div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 32 }}>🔍</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Nutzer nicht gefunden</div>
      <button onClick={() => router.back()} style={{ fontSize: 13, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>← Zurück</button>
    </div>
  )

  if (!profileUser) return null

  // Admin und eigenes Profil sehen immer alles
  const show = (key: keyof PrivacySettings): boolean => isAdmin || isOwn || privacy[key]

  // Stats berechnen
  const streak          = calcStreak(trades)
  const trefferquote    = calcTrefferquote(entries)
  const totalEinsatz    = entries.reduce((s, e) => s + e.einsatz, 0)
  const totalAusbe      = entries.filter(e => e.auszahlung !== null && e.auszahlung > 0).reduce((s, e) => s + (e.auszahlung ?? 0), 0)
  const offeneCount     = entries.filter(e => !e.market.resolved).length
  const gewonnen        = entries.filter(e => e.market.resolved && e.auszahlung !== null && e.auszahlung > 0)
  const groessterGewinn = gewonnen.length > 0 ? Math.max(...gewonnen.map(e => e.auszahlung ?? 0)) : 0
  const avgEinsatz      = entries.length > 0 ? Math.round(totalEinsatz / entries.length) : 0
  const lieblingsCat    = calcLieblingskategorie(entries.map(e => e.market))
  const av              = avatarColor(profileUser.username)

  const resolvedCount = entries.filter(e => e.market.resolved).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Nav */}
      <div style={{ background: 'var(--primary)', height: 56, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16, position: 'sticky', top: 0, zIndex: 100, borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Zurück
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{profileUser.username}</span>
        {isOwn && (
          <button
            onClick={() => router.push('/')}
            style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 14px', background: 'rgba(255,255,255,0.1)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#fff', cursor: 'pointer' }}
          >
            Bearbeiten
          </button>
        )}
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 80px' }}>

        {/* ── PROFIL-HEADER ── */}
        <div className="card" style={{ padding: '28px 24px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div style={{ flexShrink: 0 }}>
              {profileUser.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileUser.avatar_url} alt={profileUser.username} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, border: '2px solid var(--border)' }}>
                  {profileUser.username.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name + Meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.5px' }}>
                {profileUser.username}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                <span>Dabei seit {formatMemberSince(profileUser.created_at)}</span>
                <span>·</span>
                <span>Zuletzt online: {formatLastSeen(profileUser.last_seen_at)}</span>
              </div>

              {/* Platzhalter Badge/Rang */}
              <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <span style={{ fontSize: 14 }}>🏅</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>Rang folgt bald</span>
              </div>
            </div>

            {/* Guthaben — wenn sichtbar */}
            {show('guthaben') && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Guthaben</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--yes)', letterSpacing: '-0.5px' }}>{profileUser.balance.toLocaleString('de')} ₫</div>
              </div>
            )}
          </div>

          {/* Pflicht-Stats: Trefferquote, Prognosen, Streak */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            {[
              {
                label: 'Prognosen',
                value: String(entries.length),
                sub: `${resolvedCount} abgeschlossen`,
                color: 'var(--text)',
              },
              {
                label: 'Trefferquote',
                value: trefferquote !== null ? `${trefferquote}%` : '—',
                sub: trefferquote !== null ? (trefferquote >= 60 ? 'Überdurchschnittlich' : trefferquote >= 40 ? 'Solide' : 'Noch Luft nach oben') : 'Noch keine Daten',
                color: trefferquote !== null ? (trefferquote >= 60 ? 'var(--yes)' : trefferquote >= 40 ? 'var(--text)' : 'var(--no)') : 'var(--text-muted)',
              },
              {
                label: 'Streak',
                value: `${streak} ${streak === 1 ? 'Tag' : 'Tage'}`,
                sub: streak === 0 ? 'Heute nicht aktiv' : streak >= 7 ? '🔥 Serie läuft' : streak >= 3 ? 'Konstant aktiv' : 'Starte heute',
                color: streak >= 3 ? '#f59e0b' : 'var(--text)',
              },
            ].map((s, i) => (
              <div key={s.label} style={{ paddingLeft: i > 0 ? 20 : 0, borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color, letterSpacing: '-0.5px', lineHeight: 1.1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 3 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── OPTIONALE STATS ── */}
        {(show('gewinn_verlust') || show('groesster_gewinn') || show('eingesetzt_gewonnen') || show('offene_positionen') || show('lieblingskategorie') || show('durchschnittlicher_einsatz')) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>

            {show('gewinn_verlust') && (
              <div className="card" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 500 }}>Gewinn / Verlust</div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: totalAusbe - totalEinsatz >= 0 ? 'var(--yes)' : 'var(--no)' }}>
                  {totalAusbe - totalEinsatz >= 0 ? '+' : ''}{Math.round(totalAusbe - totalEinsatz).toLocaleString('de')} ₫
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 3 }}>Gesamt realisiert</div>
              </div>
            )}

            {show('groesster_gewinn') && (
              <div className="card" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 500 }}>Größter Gewinn</div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: groessterGewinn > 0 ? 'var(--yes)' : 'var(--text-muted)' }}>
                  {groessterGewinn > 0 ? `+${Math.round(groessterGewinn).toLocaleString('de')} ₫` : '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 3 }}>Einzelne Auszahlung</div>
              </div>
            )}

            {show('eingesetzt_gewonnen') && (
              <div className="card" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 500 }}>Eingesetzt / Gewonnen</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>
                  {Math.round(totalEinsatz).toLocaleString('de')} ₫
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 13 }}> eingesetzt</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--yes)', lineHeight: 1.4 }}>
                  +{Math.round(totalAusbe).toLocaleString('de')} ₫
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 13 }}> gewonnen</span>
                </div>
              </div>
            )}

            {show('offene_positionen') && (
              <div className="card" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 500 }}>Offene Positionen</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>{offeneCount}</div>
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 3 }}>Aktive Wetten</div>
              </div>
            )}

            {show('lieblingskategorie') && lieblingsCat && (
              <div className="card" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 500 }}>Lieblingskategorie</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>
                  {CAT_LABELS[lieblingsCat] ?? lieblingsCat}
                </div>
              </div>
            )}

            {show('durchschnittlicher_einsatz') && entries.length > 0 && (
              <div className="card" style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 500 }}>Ø Einsatz</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>{avgEinsatz.toLocaleString('de')} ₫</div>
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 3 }}>Pro Prognose</div>
              </div>
            )}
          </div>
        )}

        {/* ── TABS ── */}
        {show('aktivitaet') && (
          <>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
              {(['stats', 'aktivitaet'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '10px 20px', fontSize: 14,
                  fontWeight: activeTab === t ? 700 : 500,
                  color: activeTab === t ? 'var(--text)' : 'var(--text-muted)',
                  borderBottom: activeTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -1,
                }}>
                  {t === 'stats' ? 'Positionen' : 'Aktivität'}
                </button>
              ))}
            </div>

            {activeTab === 'aktivitaet' && (
              <PublicAktivitaetsFeed trades={trades} entries={entries} />
            )}
          </>
        )}

        {(!show('aktivitaet') || activeTab === 'stats') && entries.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Abgeschlossene Prognosen
            </div>
            {entries.filter(e => e.market.resolved).slice(0, 10).map((entry, i, arr) => {
              const won  = entry.auszahlung !== null && entry.auszahlung > 0
              const isYes = entry.direction === 'yes'
              return (
                <div key={entry.market.id} style={{ padding: '12px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.market.question}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Tipp: {isYes ? 'Ja' : 'Nein'} · Einsatz: {Math.round(entry.einsatz).toLocaleString('de')} ₫
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: won ? 'var(--yes)' : 'var(--no)', flexShrink: 0 }}>
                    {won ? `+${Math.round(entry.auszahlung ?? 0).toLocaleString('de')} ₫` : 'Verloren'}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {entries.length === 0 && !loading && (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
            Noch keine Prognosen.
          </div>
        )}

        {/* ── DATENSCHUTZ-TOGGLES — nur für eigenes Profil ── */}
        {isOwn && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              🔒 Was andere sehen
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {PRIVACY_LABELS.map(({ key, label }, i) => (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: i < PRIVACY_LABELS.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: privacy[key] ? 'var(--yes)' : 'var(--text-muted)', fontWeight: 600 }}>
                      {privacy[key] ? 'Öffentlich' : 'Privat'}
                    </span>
                    <Toggle checked={privacy[key]} onChange={() => togglePrivacy(key)} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              Trefferquote, Streak und Prognosen sind immer öffentlich.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── AKTIVITÄTS-FEED (öffentlich, gekürzt) ────────────────────

const COIN_COLORS: Record<string, string> = {
  BTC: '#f59e0b', ETH: '#6366f1', SOL: '#9945ff', XRP: '#00aae4',
}

function PublicAktivitaetsFeed({ trades, entries }: { trades: TradeRow[]; entries: PortfolioEntry[] }) {
  function formatTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const min  = Math.floor(diff / 60000)
    const h    = Math.floor(diff / 3600000)
    const day  = Math.floor(diff / 86400000)
    if (min < 1)  return 'Gerade eben'
    if (min < 60) return `vor ${min} Min.`
    if (h < 24)   return `vor ${h} Std.`
    if (day < 7)  return `vor ${day} Tag${day > 1 ? 'en' : ''}`
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  }

  const entryMap: Record<string, PortfolioEntry> = {}
  entries.forEach(e => { entryMap[e.market.id] = e })

  const feedItems = trades
    .filter(t => t.type === 'buy_yes' || t.type === 'buy_no')
    .slice(0, 30)

  if (feedItems.length === 0) return (
    <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Keine Aktivität.</div>
  )

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {feedItems.map((item, idx) => {
        const entry  = entryMap[item.market_id]
        const market = entry?.market
        const isYes  = item.type === 'buy_yes'
        const coinColor = market?.is_auto && market.coin ? COIN_COLORS[market.coin] ?? '#f97316' : null
        const label = market ? (market.is_auto && market.coin ? `${market.coin} · 3-Min-Markt` : market.question.length > 52 ? market.question.slice(0, 52) + '…' : market.question) : 'Unbekannter Markt'

        return (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: idx < feedItems.length - 1 ? '1px solid var(--border)' : 'none' }}>
            {coinColor ? (
              <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: coinColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>
                {market?.coin?.charAt(0)}
              </div>
            ) : (
              <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: isYes ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                {isYes ? '↑' : '↓'}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Tipp auf {isYes ? 'Ja ↑' : 'Nein ↓'}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{Math.round(Math.abs(item.cost)).toLocaleString('de')} ₫</div>
              <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>{formatTime(item.created_at)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
