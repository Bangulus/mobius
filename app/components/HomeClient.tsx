'use client';

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminPanel from './AdminPanel'
import ProfileView from './ProfileView'
import { useAppShell, ADMIN_ID, Market } from './AppShellContext'
import { Icon } from './Icons'

// Re-Export, damit app/page.tsx (import HomeClient, { Market } from './components/HomeClient')
// unverändert funktioniert — Market lebt jetzt in AppShellContext.tsx.
export type { Market }


const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    cache: 'no-store',
  })
  return res.json()
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
  { id: 'Finanzen-Tag',   label: 'Aktueller Handelstag',  icon: 'calendar' },
  { id: 'Finanzen-Woche', label: 'Aktuelle Handelswoche', icon: 'calendar-event' },
]

const FINANCE_GROUP_MAP: Record<string, string> = {
  'Finanzen-Tag':   'Aktueller Handelstag',
  'Finanzen-Woche': 'Aktuelle Handelswoche',
}

// initialCategory bleibt im Typ (nicht mehr genutzt), damit app/kategorie/[slug]/page.tsx
// weiter kompiliert, bis Deploy 2 diese Route ersetzt. Shell ermittelt die Kategorie für
// diese Seiten jetzt selbst über usePathname().
export default function HomeClient({ initialMarkets }: { initialCategory?: string; initialMarkets?: Market[] }) {
  const router = useRouter()
  const { user, setUser, logout, darkMode, setDarkMode, view, category, searchQuery, selectCategory, openAuth } = useAppShell()

  const [markets, setMarkets]                     = useState<Market[]>(initialMarkets ?? [])
  const [pastSoccerMarkets, setPastSoccerMarkets]  = useState<Market[]>([])
  const [loading, setLoading]                      = useState(!initialMarkets)
  const marketsRef                                 = useRef<Market[]>(initialMarkets ?? [])
  const triggeredCoinsRef                          = useRef<Record<string, number>>({})

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    loadMarkets(!initialMarkets)
  }, [loadMarkets])

  useEffect(() => {
    if (category === 'Bundesliga') loadPastSoccerMarkets()
  }, [category, loadPastSoccerMarkets])

  useEffect(() => {
    const id = setInterval(() => loadMarkets(), 10000)
    return () => clearInterval(id)
  }, [loadMarkets])

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      const autoMarkets = marketsRef.current.filter(
        m => m.is_auto && m.coin && !m.resolved && !m.match_id &&
        m.category !== 'weather' && m.category !== 'Wetter'
      )
      for (const coin of COINS) {
        const market = autoMarkets.find(m => m.coin === coin)
        if (!market) {
          const lastTriggered = triggeredCoinsRef.current[coin + '_missing'] ?? 0
          if (now - lastTriggered > 60000) {
            triggeredCoinsRef.current[coin + '_missing'] = now
            fetch('/api/create-crypto-market', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ coin }),
            }).then(() => loadMarkets()).catch(() => {})
          }
        }
      }
    }, 5000)
    return () => clearInterval(id)
  }, [loadMarkets])

  const isSportCategory = category === 'Sport' || category === 'Fußball' || category === 'Bundesliga'
    || category === 'WM' || category === 'CL' || category === 'DFB-Kader'
  const isFinanzCategory = category.startsWith('Finanzen-')

  function isPolitikDeutschland(m: Market): boolean {
    if (m.category === 'Politik-Deutschland') return true
    return m.category === 'Politik' && !!(m.group_title && m.group_title.toLowerCase().includes('landtag'))
  }
  function isPolitikUSA(m: Market): boolean {
    if (m.category === 'Politik-USA') return true
    if (m.category !== 'Politik') return false
    if (m.group_title) return false
    const q = (m.question ?? '').toLowerCase()
    return q.includes('trump') || q.includes('demokraten') || q.includes('us-senat') || q.includes('usa') || q.includes('senat 2026')
  }

  const filteredMarkets = markets.filter((m) => {
    const matchSearch = searchQuery === '' ||
      (m.question ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.short_label ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.display_group ?? '').toLowerCase().includes(searchQuery.toLowerCase())

    // Bei aktiver Suche über alle offenen Märkte suchen, unabhängig von der
    // gerade gewählten Kategorie-Tab (Kategorie-Filter wird übersprungen).
    if (searchQuery !== '') return matchSearch

    let matchCat = false
    if (category === 'Politik-Deutschland') {
      matchCat = isPolitikDeutschland(m)
    } else if (category === 'Politik-USA') {
      matchCat = isPolitikUSA(m)
    } else if (category === 'Bundesliga') {
      matchCat = !!m.match_id
    } else if (category === 'Fußball') {
      matchCat = m.category === 'sport' || m.category === 'Sport'
    } else if (category === 'Sport') {
      matchCat = m.category === 'sport' || m.category === 'Sport'
    } else if (category === 'WM' || category === 'CL') {
      const groupFilter = SPORT_GROUP_FILTERS[category]
      matchCat = m.group_title === groupFilter || m.category === `Sport-Fußball-${category === 'WM' ? 'WM 2026' : 'CL'}`
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
    return matchCat
  })

  const categoryLabel: Record<string, string> = {
    'Politik-Deutschland': 'Politik · Deutschland',
    'Politik-USA':         'Politik · USA',
    'Finanzen-Tag':        'Finanzen · Aktueller Handelstag',
    'Finanzen-Woche':      'Finanzen · Aktuelle Handelswoche',
    'F1':                  'Formel 1',
  }

  return (
    <>
      {view === 'admin' && user?.id === ADMIN_ID && (<AdminPanel userId={user.id} openMarkets={markets} onMarketResolved={loadMarkets} />)}
      {view === 'profil' && user && (
        <>
          <ProfileView
            userId={user.id}
            token={user.id}
            displayName={user.username}
            avatarUrl={user.avatar_url ?? ''}
            balance={user.balance}
            xp={user.xp}
            level={user.level}
            rp={user.rp}
            title={user.title}
            peakTitle={user.peak_title}
            createdAt={user.created_at}
            onUsernameChange={(name) => setUser({ ...user, username: name })}
            onAvatarChange={(url) => setUser({ ...user, avatar_url: url })}
          />
          <div style={{ marginTop: 24 }}>
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: 12, cursor: 'pointer', fontSize: 14, color: 'var(--text)', width: '100%' }}
            >
              <Icon name={darkMode ? 'sun' : 'moon'} size={20} />
              <span>{darkMode ? 'Light Mode aktivieren' : 'Dark Mode aktivieren'}</span>
            </button>
            <button
              onClick={logout}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--no-light)', border: '0.5px solid var(--no-border)', borderRadius: 12, cursor: 'pointer', fontSize: 14, color: 'var(--no)', width: '100%', marginTop: 8 }}
            >
              <span>Abmelden</span>
            </button>
          </div>
        </>
      )}
      {view === 'profil' && !user && (
        <div style={{ textAlign: 'center', padding: '48px 16px' }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><Icon name="user" size={32} /></div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Kein Konto</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Melde dich an um dein Profil zu sehen.</div>
          <button className="submit-btn yes" onClick={() => openAuth('login')} style={{ maxWidth: 200, margin: '0 auto' }}>Anmelden</button>
        </div>
      )}
      {view === 'markets' && (
        <>
          <div className="section-head">
            <div className="section-title" style={{ fontSize: 22, fontWeight: 800 }}>{searchQuery ? `Suche: „${searchQuery}"` : (categoryLabel[category] ?? category)}</div>
            <div className="section-link" onClick={() => loadMarkets()}>Aktualisieren</div>
          </div>
          {isFinanzCategory && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
              {FINANCE_SUB_TABS.map(tab => (
                <button key={tab.id} onClick={() => selectCategory(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: category === tab.id ? 700 : 500, border: category === tab.id ? '1px solid var(--accent, #6366f1)' : '1px solid var(--border)', background: category === tab.id ? 'var(--accent-light, rgba(99,102,241,0.1))' : 'var(--surface)', color: category === tab.id ? 'var(--accent, #6366f1)' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <Icon name={tab.icon} size={14} /> {tab.label}
                </button>
              ))}
            </div>
          )}
          {loading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '24px 0' }}>Wird mit 1 % Motivation geladen…</div>
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
      {view === 'portfolio' && !user && (
        <div style={{ textAlign: 'center', padding: '48px 16px' }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><Icon name="chart-bar" size={32} /></div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Kein Konto</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Melde dich an um dein Portfolio zu sehen.</div>
          <button className="submit-btn yes" onClick={() => openAuth('login')} style={{ maxWidth: 200, margin: '0 auto' }}>Anmelden</button>
        </div>
      )}
    </>
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
    <div onClick={() => onOpen(home.id)} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', transition: 'background 0.1s', position: 'relative' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>
      <Link href={`/markets/${home.id}`} aria-hidden="true" tabIndex={-1} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
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

function WeatherMarketCard({ market, onClick }: { market: Market; onClick: () => void }) {
  const prob  = calcProb(market.q_yes, market.q_no, market.b)
  const isLow = prob < 50
  const city  = market.short_label ?? market.display_group ?? market.question
  const tempMatch = market.question.match(/\((-?\d+\.?\d*)°C\)/)
  const temp = tempMatch ? `${tempMatch[1]}°C` : (market.start_price != null ? `${market.start_price}°C` : null)

  return (
    <div className="market-card" onClick={onClick} style={{ position: 'relative' }}>
      <Link href={`/markets/${market.id}`} aria-hidden="true" tabIndex={-1} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="cloud" size={16} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{city}</span>
        </div>
        {temp && (
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0ea5e9', background: 'rgba(14,165,233,0.1)', padding: '2px 8px', borderRadius: 8 }}>
            {temp} gestern
          </span>
        )}
      </div>
      <div className="market-card-question" style={{ fontSize: 13, marginBottom: 10 }}>
        Wird es dort heute wärmer als gestern?
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
                        <div key={m.id} onClick={() => onOpen(m.id)} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 80px 180px', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: 'var(--card)', borderBottom: i < sortedWithProbs.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s', position: 'relative' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')} onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}>
                          <Link href={`/markets/${m.id}`} aria-hidden="true" tabIndex={-1} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
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
    <div className="market-card" style={{ padding: '14px 18px', cursor: 'pointer', position: 'relative' }} onClick={() => onOpen((homeMarket ?? anyMarket).id)}>
      <Link href={`/markets/${(homeMarket ?? anyMarket).id}`} aria-hidden="true" tabIndex={-1} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
      {lastGoals.length > 0 && (<div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>{lastGoals.map((g, i) => (<div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="ball-football" size={11} /><span style={{ fontWeight: 600 }}>{g.matchMinute}&apos;</span><span>{g.goalGetterName}{g.isOwnGoal ? ' (ET)' : ''}</span><span style={{ color: 'var(--text-subtle)', marginLeft: 'auto' }}>{g.scoreTeam1}:{g.scoreTeam2}</span></div>))}</div>)}
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
    <div className="market-card" onClick={onClick} style={{ position: 'relative' }}>
      <Link href={`/markets/${market.id}`} aria-hidden="true" tabIndex={-1} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
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
  interface Position { market_id: string; shares_yes: number; shares_no: number; question: string; q_yes: number; q_no: number; b: number; resolved: boolean; resolution?: string }
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    dbGet('positions', `user_id=eq.${userId}&select=*`).then(async (posData) => {
      if (!posData || posData.length === 0) { setLoading(false); return }
      const ids = posData.map((p: { market_id: string }) => p.market_id).join(',')
      const mktData = await dbGet('markets', `id=in.(${ids})&select=id,question,q_yes,q_no,b,resolved,resolution`)
      const mktMap: Record<string, Market> = {}
      mktData?.forEach((m: Market) => { mktMap[m.id] = m })
      setPositions(posData.map((p: { market_id: string; shares_yes: number; shares_no: number }) => ({ ...p, ...mktMap[p.market_id] })))
      setLoading(false)
    })
  }, [userId])

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '24px 0' }}>manifesting results...</div>

  const openPositions   = positions.filter(p => !p.resolved)
  const closedPositions = positions.filter(p => p.resolved)
  const totalInvested   = positions.reduce((s, p) => s + (p.shares_yes > 0 ? p.shares_yes : 0) + (p.shares_no > 0 ? p.shares_no : 0), 0)
  const totalPotential  = positions.filter(p => !p.resolved).reduce((s, p) => {
    const shares = p.shares_yes > p.shares_no ? p.shares_yes : p.shares_no
    return s + shares
  }, 0)

  if (positions.length === 0) return (
    <div className="card" style={{ textAlign: 'center', padding: 32 }}>
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center', color: 'var(--text-muted)' }}><Icon name="chart-bar" size={32} /></div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Noch keine Positionen.</div>
      <div style={{ fontSize: 13, color: 'var(--text-subtle)' }}>Platziere deine erste Wette auf einen Markt.</div>
    </div>
  )

  return (
    <div>
      <div className="section-head">
        <div className="section-title" style={{ fontSize: 22, fontWeight: 800 }}>Mein Portfolio</div>
      </div>
      <div className="mobile-portfolio-summary" style={{ marginBottom: 20 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Positionen</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{openPositions.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>offen</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Max. Auszahlung</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--yes)' }}>{Math.round(totalPotential).toLocaleString('de')} ₫</div>
          <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>wenn alle gewinnen</div>
        </div>
      </div>
      {openPositions.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Offen</div>
          {openPositions.map((p, i) => {
            const prob = calcProb(p.q_yes, p.q_no, p.b)
            const isYes = p.shares_yes >= p.shares_no
            const shares = isYes ? p.shares_yes : p.shares_no
            return (
              <div key={i} className="mobile-pos-card" onClick={() => router.push(`/markets/${p.market_id}`)}>
                <div className="mobile-pos-top">
                  <div className="mobile-pos-question">{p.question}</div>
                  <div className="mobile-pos-badge" style={{ background: isYes ? 'var(--yes-light)' : 'var(--no-light)', color: isYes ? 'var(--yes)' : 'var(--no)', border: `0.5px solid ${isYes ? 'var(--yes-border)' : 'var(--no-border)'}` }}>
                    {isYes ? 'JA' : 'NEIN'}
                  </div>
                </div>
                <div className="mobile-pos-meta">
                  <span><strong>{Math.round(shares)} Anteile</strong></span>
                  <span>Kurs <strong>{isYes ? prob : 100 - prob}%</strong></span>
                  <span>Ausz. <strong style={{ color: 'var(--yes)' }}>{Math.round(shares)} ₫</strong></span>
                </div>
                <div className="prob-bar">
                  <div className={`prob-bar-fill ${prob < 50 ? 'low' : ''}`} style={{ width: `${prob}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
      {closedPositions.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Abgeschlossen</div>
          {closedPositions.map((p, i) => {
            const isYes = p.shares_yes >= p.shares_no
            const won = (p.resolution === 'yes' && isYes) || (p.resolution === 'no' && !isYes)
            const shares = isYes ? p.shares_yes : p.shares_no
            return (
              <div key={i} className="mobile-pos-card" style={{ opacity: 0.75 }} onClick={() => router.push(`/markets/${p.market_id}`)}>
                <div className="mobile-pos-top">
                  <div className="mobile-pos-question">{p.question}</div>
                  <div className="mobile-pos-badge" style={{ background: won ? 'var(--yes-light)' : 'var(--no-light)', color: won ? 'var(--yes)' : 'var(--no)' }}>
                    {won ? 'GEWONNEN ✓' : 'VERLOREN'}
                  </div>
                </div>
                <div className="mobile-pos-meta">
                  <span>{isYes ? 'JA' : 'NEIN'}</span>
                  {won && <span style={{ color: 'var(--yes)', fontWeight: 700 }}>+{Math.round(shares)} ₫</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-subtle)', textAlign: 'center', marginTop: 16 }}>
        Gesamt: {positions.length} Positionen · {Math.round(totalInvested).toLocaleString('de')} ₫ investiert
      </div>
    </div>
  )
}
