'use client';

import { useState, useEffect, useCallback } from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    cache: 'no-store',
  });
  return res.json();
}

interface Props {
  userId: string;
  token: string;
  displayName: string;
  avatarUrl: string;
  balance: number | null;
  onUsernameChange: (name: string) => void;
  onAvatarChange: (url: string) => void;
}

interface TradeRow {
  id: string;
  market_id: string;
  type: string;
  shares: number;
  cost: number;
  created_at: string;
}

interface MarketRow {
  id: string;
  question: string;
  resolved: boolean;
  resolution?: string;
  is_auto?: boolean;
  coin?: string;
  category?: string;
  start_price?: number;
  end_price?: number;
  closes_at?: string;
}

interface PortfolioEntry {
  market: MarketRow;
  einsatz: number;
  direction: 'yes' | 'no';
  auszahlung: number | null;
  tradeCreatedAt: string;
  marketClosedAt: string | null;
}

const COIN_COLORS: Record<string, string> = {
  BTC: '#f59e0b', ETH: '#6366f1', SOL: '#9945ff', XRP: '#00aae4',
};

const AVATAR_COLORS = [
  { bg: '#eff6ff', color: '#1d4ed8' },
  { bg: '#f0fdf4', color: '#166534' },
  { bg: '#fdf4ff', color: '#6b21a8' },
  { bg: '#fffbeb', color: '#92400e' },
  { bg: '#f0f9ff', color: '#075985' },
];
function avatarColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function calcStreak(trades: TradeRow[]): number {
  if (trades.length === 0) return 0;
  const days = new Set(
    trades.map(t => {
      const d = new Date(t.created_at);
      return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    })
  );
  let streak = 0;
  const now = new Date();
  const check = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  while (true) {
    const key = `${check.getUTCFullYear()}-${check.getUTCMonth()}-${check.getUTCDate()}`;
    if (!days.has(key)) break;
    streak++;
    check.setUTCDate(check.getUTCDate() - 1);
  }
  return streak;
}

function calcTrefferquote(entries: PortfolioEntry[]): number | null {
  const resolved = entries.filter(e => e.market.resolved && e.market.resolution);
  if (resolved.length === 0) return null;
  const correct = resolved.filter(e => e.market.resolution === e.direction).length;
  return Math.round((correct / resolved.length) * 100);
}

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return { date, time };
}

type TabType = 'positionen' | 'aktivitaet';
type SubTabType = 'aktiv' | 'geschlossen';

export default function ProfileView({ userId, displayName, avatarUrl, balance, onUsernameChange, onAvatarChange }: Props) {
  const [newUsername, setNewUsername]           = useState(displayName);
  const [uploadingAvatar, setUploadingAvatar]   = useState(false);
  const [savingUsername, setSavingUsername]     = useState(false);
  const [profileMessage, setProfileMessage]     = useState('');
  const [editingUsername, setEditingUsername]   = useState(false);
  const [tab, setTab]                           = useState<TabType>('positionen');
  const [subTab, setSubTab]                     = useState<SubTabType>('aktiv');
  const [allRows, setAllRows]                   = useState<PortfolioEntry[]>([]);
  const [allTrades, setAllTrades]               = useState<TradeRow[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);

  const totalEinsatz     = allRows.reduce((s, r) => s + r.einsatz, 0);
  const totalAusbe       = allRows.filter(r => r.auszahlung !== null && r.auszahlung > 0).reduce((s, r) => s + (r.auszahlung ?? 0), 0);
  const offeneCount      = allRows.filter(r => !r.market.resolved).length;
  const gewonnen         = allRows.filter(r => r.market.resolved && r.auszahlung !== null && r.auszahlung > 0);
  const groessterGewinn  = gewonnen.length > 0 ? Math.max(...gewonnen.map(r => r.auszahlung ?? 0)) : 0;
  const aktiveRows       = allRows.filter(r => !r.market.resolved);
  const geschlosseneRows = allRows.filter(r => r.market.resolved);
  const displayRows      = subTab === 'aktiv' ? aktiveRows : geschlosseneRows;

  const streak       = calcStreak(allTrades);
  const trefferquote = calcTrefferquote(allRows);

  const loadPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    const trades: TradeRow[] = await dbGet('trades', `user_id=eq.${userId}&select=*&order=created_at.desc`);
    setAllTrades(trades ?? []);
    if (!trades || trades.length === 0) { setPortfolioLoading(false); return; }

    const seen: Record<string, boolean> = {};
    const marketIds: string[] = [];
    trades.forEach(t => { if (!seen[t.market_id]) { seen[t.market_id] = true; marketIds.push(t.market_id); } });

    const markets: MarketRow[] = await dbGet('markets', `id=in.(${marketIds.join(',')})&select=*`);
    const marketMap: Record<string, MarketRow> = {};
    markets.forEach(m => { marketMap[m.id] = m; });

    const entryMap: Record<string, PortfolioEntry> = {};
    for (const trade of trades) {
      const market = marketMap[trade.market_id];
      if (!market) continue;
      const isBuy  = trade.type === 'buy_yes' || trade.type === 'buy_no';
      const isSell = trade.type === 'sell_yes' || trade.type === 'sell_no';
      const dir: 'yes' | 'no' = trade.type.includes('yes') ? 'yes' : 'no';
      if (!entryMap[trade.market_id]) {
        // resolved_at bevorzugen (manuell gesetzt), sonst closes_at
        const closedAt = (market as any).resolved_at ?? market.closes_at ?? null;
        entryMap[trade.market_id] = {
          market,
          einsatz: 0,
          direction: dir,
          auszahlung: null,
          tradeCreatedAt: trade.created_at,
          marketClosedAt: closedAt,
        };
      }
      const entry = entryMap[trade.market_id];
      if (isBuy)  { entry.einsatz += Math.abs(trade.cost); entry.direction = dir; }
      if (isSell) { entry.auszahlung = (entry.auszahlung ?? 0) + Math.abs(trade.cost); }
    }
    for (const entry of Object.values(entryMap)) {
      const m = entry.market;
      if (!m.resolved || entry.auszahlung !== null) continue;
      const won = (m.resolution === 'yes' && entry.direction === 'yes') ||
                  (m.resolution === 'no'  && entry.direction === 'no');
      if (won) {
        const mTrades = trades.filter(t => t.market_id === m.id && (t.type === 'buy_yes' || t.type === 'buy_no'));
        entry.auszahlung = Math.round(mTrades.reduce((s, t) => s + (t.shares ?? 0), 0));
      } else {
        entry.auszahlung = 0;
      }
    }
    setAllRows(Object.values(entryMap));
    setPortfolioLoading(false);
  }, [userId]);

  useEffect(() => { if (userId) loadPortfolio(); }, [userId, loadPortfolio]);

  async function saveUsername() {
    if (!newUsername.trim()) return;
    setSavingUsername(true);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ username: newUsername.trim() }),
    });
    if (res.ok) { onUsernameChange(newUsername.trim()); setProfileMessage('Gespeichert ✓'); setEditingUsername(false); }
    else { setProfileMessage('Fehler beim Speichern.'); }
    setSavingUsername(false);
    setTimeout(() => setProfileMessage(''), 3000);
  }

  async function uploadAvatar(file: File) {
    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    const res = await fetch('/api/upload-avatar', { method: 'POST', body: formData });
    if (res.ok) {
      const { url } = await res.json();
      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ avatar_url: url }),
      });
      onAvatarChange(url);
      setProfileMessage('Profilbild gespeichert ✓');
    } else {
      setProfileMessage('Fehler beim Upload.');
    }
    setUploadingAvatar(false);
    setTimeout(() => setProfileMessage(''), 4000);
  }

  const av = avatarColor(displayName);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 24 }}>

        {/* Links: Avatar + Stats */}
        <div className="card" style={{ padding: '28px 28px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 24 }}>
            <div style={{ flexShrink: 0 }}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, border: '2px solid var(--border)' }}>
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                {editingUsername ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') saveUsername(); if (e.key === 'Escape') setEditingUsername(false); }}
                      style={{ fontSize: 20, fontWeight: 700, padding: '4px 10px', borderRadius: 8, border: '1.5px solid var(--accent)', background: 'var(--surface)', color: 'var(--text)', width: 200 }} />
                    <button onClick={saveUsername} disabled={savingUsername}
                      style={{ padding: '4px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      {savingUsername ? '…' : 'Speichern'}
                    </button>
                    <button onClick={() => setEditingUsername(false)}
                      style={{ padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>✕</button>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{displayName}</span>
                    <button onClick={() => setEditingUsername(true)} title="Name ändern"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px', fontSize: 14, lineHeight: 1, borderRadius: 4 }}>✎</button>
                  </>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
                <span>Guthaben: <strong style={{ color: 'var(--yes)' }}>{(balance ?? 0).toLocaleString('de')} ₫</strong></span>
                <span>·</span>
                <span>{allRows.length} Prognosen</span>
              </div>
              {profileMessage && (
                <div style={{ marginTop: 8, fontSize: 12, color: profileMessage.startsWith('Fehler') ? 'var(--no)' : 'var(--yes)' }}>{profileMessage}</div>
              )}
            </div>
            <label style={{ fontSize: 12, padding: '6px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer', color: 'var(--text)', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {uploadingAvatar ? 'Lädt…' : 'Bild ändern'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadAvatar(e.target.files[0]); }} />
            </label>
          </div>

          {/* Stats-Zeile */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            {[
              { label: 'Portfoliowert',  value: `${Math.round(balance ?? 0).toLocaleString('de')} ₫`, color: 'var(--text)' },
              { label: 'Größter Gewinn', value: groessterGewinn > 0 ? `+${Math.round(groessterGewinn).toLocaleString('de')} ₫` : '—', color: groessterGewinn > 0 ? 'var(--yes)' : 'var(--text-muted)' },
              { label: 'Prognosen',      value: String(allRows.length), color: 'var(--text)' },
            ].map((s, i) => (
              <div key={s.label} style={{ paddingLeft: i > 0 ? 20 : 0, borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Rechts: Gewinn/Verlust + Streak + Trefferquote */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Gewinn/Verlust */}
          <div className="card" style={{ padding: '24px 24px 20px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--yes)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gewinn / Verlust</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: totalAusbe - totalEinsatz >= 0 ? 'var(--yes)' : 'var(--no)', letterSpacing: '-1px', marginBottom: 4 }}>
              {totalAusbe - totalEinsatz >= 0 ? '+' : ''}{Math.round(totalAusbe - totalEinsatz).toLocaleString('de')} ₫
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>Gesamt</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'rgba(22,163,74,0.06)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Eingesetzt</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{Math.round(totalEinsatz).toLocaleString('de')} ₫</div>
              </div>
              <div style={{ background: 'rgba(22,163,74,0.06)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gewonnen</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--yes)' }}>+{Math.round(totalAusbe).toLocaleString('de')} ₫</div>
              </div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Offene Positionen</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{offeneCount}</span>
            </div>
          </div>

          {/* Streak & Trefferquote */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="card" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Streak</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: streak >= 3 ? '#f59e0b' : 'var(--text)', letterSpacing: '-1px', lineHeight: 1 }}>{streak}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{streak === 1 ? 'Tag' : 'Tage'}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                {streak === 0 ? 'Heute noch nicht aktiv' : streak >= 7 ? 'Serie läuft' : streak >= 3 ? 'Konstant aktiv' : 'Starte heute'}
              </div>
            </div>
            <div className="card" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Trefferquote</div>
              {trefferquote === null ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Noch keine Daten</div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-1px', lineHeight: 1, color: trefferquote >= 60 ? 'var(--yes)' : trefferquote >= 40 ? 'var(--text)' : 'var(--no)' }}>{trefferquote}</span>
                    <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>%</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                    {trefferquote >= 60 ? 'Überdurchschnittlich' : trefferquote >= 40 ? 'Solide' : 'Noch Luft nach oben'}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 20, display: 'flex' }}>
        {(['positionen', 'aktivitaet'] as TabType[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 20px', fontSize: 14,
            fontWeight: tab === t ? 700 : 500,
            color: tab === t ? 'var(--text)' : 'var(--text-muted)',
            borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.15s',
          }}>
            {t === 'positionen' ? 'Positionen' : 'Aktivität'}
          </button>
        ))}
      </div>

      {/* ── POSITIONEN ── */}
      {tab === 'positionen' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {(['aktiv', 'geschlossen'] as SubTabType[]).map(s => (
              <button key={s} onClick={() => setSubTab(s)} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: '1px solid var(--border)',
                background: subTab === s ? 'var(--text)' : 'var(--surface)',
                color: subTab === s ? 'var(--bg)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}>
                {s === 'aktiv' ? `Aktiv (${aktiveRows.length})` : `Geschlossen (${geschlosseneRows.length})`}
              </button>
            ))}
          </div>

          {portfolioLoading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 13 }}>Wird geladen…</div>
          ) : displayRows.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
              {subTab === 'aktiv' ? 'Keine aktiven Positionen.' : 'Noch keine abgeschlossenen Positionen.'}
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface)' }}>
                    {['Markt', 'Tipp', 'Eingesetzt', 'Ergebnis', 'Auszahlung', subTab === 'aktiv' ? 'Gesetzt am' : 'Geschlossen am'].map((h, i) => (
                      <th key={h} style={{
                        textAlign: i === 0 ? 'left' : 'right', fontSize: 11, fontWeight: 600,
                        color: 'var(--text-muted)', padding: '12px 20px',
                        borderBottom: '1px solid var(--border)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((entry) => {
                    const m = entry.market;
                    const isSport = m.category === 'sport';
                    const isYes = entry.direction === 'yes';

                    // Richtungsbezeichnung
                    const richtungLabel = isSport
                      ? (isYes ? 'Ja' : 'Nein')
                      : m.is_auto
                        ? (isYes ? '↑ Up' : '↓ Down')
                        : (isYes ? 'Ja' : 'Nein');

                    // Marktname
                    const marktName = isSport
                      ? m.question
                      : m.is_auto && m.coin
                        ? `${m.coin} · 3-Minuten-Markt`
                        : m.question;

                    // Icon
                    const iconEl = isSport ? (
                      <span style={{ width: 28, height: 28, borderRadius: 8, background: '#16a34a22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                        ⚽
                      </span>
                    ) : m.is_auto && m.coin ? (
                      <span style={{ width: 28, height: 28, borderRadius: 8, background: COIN_COLORS[m.coin] ?? '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                        {m.coin.charAt(0)}
                      </span>
                    ) : null;

                    const resolved = m.resolved;
                    const won  = resolved && entry.auszahlung !== null && entry.auszahlung > 0;
                    const lost = resolved && entry.auszahlung === 0;

                    // Datum
                    const dateSource = subTab === 'geschlossen' && entry.marketClosedAt
                      ? entry.marketClosedAt
                      : entry.tradeCreatedAt;
                    const { date, time } = formatDateTime(dateSource);

                    // Ergebnis-Label für Sport
                    let ergebnisLabel = '';
                    if (resolved) {
                      if (isSport) {
                        ergebnisLabel = m.resolution === 'yes' ? 'Ja ✓' : m.resolution === 'no' ? 'Nein ✗' : 'Unentschieden';
                      } else {
                        ergebnisLabel = m.is_auto
                          ? (m.resolution === 'yes' ? 'UP ↑' : 'DOWN ↓')
                          : (m.resolution === 'yes' ? 'Ja' : 'Nein');
                      }
                    }

                    return (
                      <tr key={entry.market.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        {/* Markt */}
                        <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text)', maxWidth: 280 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {iconEl}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 240 }}>
                              {marktName}
                            </span>
                          </div>
                        </td>
                        {/* Tipp */}
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: isYes ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)', color: isYes ? '#15803d' : '#b91c1c' }}>
                            {richtungLabel}
                          </span>
                        </td>
                        {/* Eingesetzt */}
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                          {Math.round(entry.einsatz).toLocaleString('de')} ₫
                        </td>
                        {/* Ergebnis */}
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          {!resolved ? (
                            <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'rgba(245,158,11,0.12)', color: '#b45309', fontWeight: 600 }}>Läuft</span>
                          ) : (
                            <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: won ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)', color: won ? '#15803d' : '#b91c1c' }}>
                              {ergebnisLabel}
                            </span>
                          )}
                        </td>
                        {/* Auszahlung */}
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: 13, fontWeight: 700 }}>
                          {!resolved && entry.auszahlung === null ? (
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12 }}>ausstehend</span>
                          ) : won ? (
                            <span style={{ color: 'var(--yes)' }}>+{Math.round(entry.auszahlung ?? 0).toLocaleString('de')} ₫</span>
                          ) : lost ? (
                            <span style={{ color: 'var(--no)' }}>–{Math.round(entry.einsatz).toLocaleString('de')} ₫</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        {/* Datum */}
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{date}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{time}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── AKTIVITÄT ── */}
      {tab === 'aktivitaet' && (
        <AktivitaetsFeed userId={userId} />
      )}
    </div>
  );
}

// ── FEED ────────────────────────────────────────────────────

const COIN_COLORS_FEED: Record<string, string> = {
  BTC: '#f59e0b', ETH: '#6366f1', SOL: '#9945ff', XRP: '#00aae4',
};

interface FeedMarket {
  question: string;
  is_auto: boolean;
  coin?: string;
  category?: string;
  resolved: boolean;
  resolution?: string;
}

interface FeedItem {
  id: string;
  market_id: string;
  type: string;
  shares: number;
  cost: number;
  created_at: string;
  market?: FeedMarket;
}

function AktivitaetsFeed({ userId }: { userId: string }) {
  const [items, setItems]     = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const raw: FeedItem[] = await dbGet('trades', `user_id=eq.${userId}&select=*&order=created_at.desc&limit=100`);
      if (!raw || raw.length === 0) { setLoading(false); return; }

      const seen: Record<string, boolean> = {};
      const marketIds: string[] = [];
      raw.forEach(t => { if (!seen[t.market_id]) { seen[t.market_id] = true; marketIds.push(t.market_id); } });

      const markets = await dbGet('markets', `id=in.(${marketIds.join(',')})&select=id,question,is_auto,coin,category,resolved,resolution`);
      const mMap: Record<string, FeedMarket> = {};
      markets?.forEach((m: FeedMarket & { id: string }) => { mMap[m.id] = m; });

      const withMarkets: FeedItem[] = raw.map(t => ({ ...t, market: mMap[t.market_id] }));

      const winItems: FeedItem[] = [];
      const processedWins = new Set<string>();

      for (const t of withMarkets) {
        const m = t.market;
        if (!m?.resolved || processedWins.has(t.market_id)) continue;

        const myBuys = withMarkets.filter(
          x => x.market_id === t.market_id && (x.type === 'buy_yes' || x.type === 'buy_no')
        );
        if (myBuys.length === 0) { processedWins.add(t.market_id); continue; }

        const direction = myBuys[0].type.includes('yes') ? 'yes' : 'no';
        const won = m.resolution === direction;
        processedWins.add(t.market_id);
        if (!won) continue;

        const totalShares = myBuys.reduce((s, x) => s + (x.shares ?? 0), 0);
        if (totalShares <= 0) continue;

        const firstBuyTime = new Date(myBuys[myBuys.length - 1].created_at).getTime();
        winItems.push({
          id: `win_${t.market_id}`,
          market_id: t.market_id,
          type: 'win',
          shares: totalShares,
          cost: totalShares,
          created_at: new Date(firstBuyTime + 3 * 60 * 1000).toISOString(),
          market: m,
        });
      }

      const combined = [...withMarkets, ...winItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setItems(combined);
      setLoading(false);
    }
    load();
  }, [userId]);

  function formatTime(iso: string) {
    const d    = new Date(iso);
    const diff = Date.now() - d.getTime();
    const min  = Math.floor(diff / 60000);
    const h    = Math.floor(diff / 3600000);
    const day  = Math.floor(diff / 86400000);
    if (min < 1)  return 'Gerade eben';
    if (min < 60) return `vor ${min} Min.`;
    if (h < 24)   return `vor ${h} Std.`;
    if (day < 7)  return `vor ${day} Tag${day > 1 ? 'en' : ''}`;
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 13 }}>Wird geladen…</div>
  );
  if (items.length === 0) return (
    <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
      Noch keine Aktivität.
    </div>
  );

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {items.map((item, idx) => {
        const m      = item.market;
        const isSport = m?.category === 'sport';
        const isBuy  = item.type.startsWith('buy');
        const isSell = item.type.startsWith('sell');
        const isWin  = item.type === 'win';
        const isYes  = item.type.includes('yes');

        const coinColor = !isWin && !isSport && m?.is_auto && m.coin
          ? COIN_COLORS_FEED[m.coin] ?? '#f97316'
          : null;

        // Marktname: Sport zeigt die echte Frage
        const marketLabel = m
          ? isSport
            ? (m.question.length > 52 ? m.question.slice(0, 52) + '…' : m.question)
            : m.is_auto
              ? `${m.coin} · 3-Min-Markt`
              : (m.question.length > 52 ? m.question.slice(0, 52) + '…' : m.question)
          : 'Unbekannter Markt';

        const dirLabel = isSport
          ? (isYes ? 'Ja' : 'Nein')
          : m?.is_auto
            ? (isYes ? 'Up ↑' : 'Down ↓')
            : (isYes ? 'Ja' : 'Nein');

        let iconBg      = 'rgba(99,102,241,0.12)';
        let iconContent = '⇄';
        if (isWin)       { iconBg = 'rgba(22,163,74,0.15)'; iconContent = '🏆'; }
        else if (isSport) { iconBg = 'rgba(22,163,74,0.10)'; iconContent = '⚽'; }
        else if (isBuy)  { iconBg = isYes ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)'; iconContent = isYes ? '↑' : '↓'; }

        let subText     = '';
        let amountLabel = '';
        let amountColor = 'var(--text)';

        if (isWin) {
          const resLabel = isSport
            ? (m?.resolution === 'yes' ? 'Ja ✓' : 'Nein ✗')
            : m?.is_auto
              ? (m.resolution === 'yes' ? 'Up ↑' : 'Down ↓')
              : (m?.resolution === 'yes' ? 'Ja' : 'Nein');
          subText     = `Gewonnen · ${resLabel}`;
          amountLabel = `+${Math.round(item.cost).toLocaleString('de')} ₫`;
          amountColor = 'var(--yes)';
        } else if (isBuy) {
          subText     = `Einsatz auf ${dirLabel}`;
          amountLabel = `Einsatz: ${Math.round(Math.abs(item.cost)).toLocaleString('de')} ₫`;
          amountColor = 'var(--text-muted)';
        } else if (isSell) {
          subText     = `Verkauft · ${dirLabel}`;
          amountLabel = `+${Math.round(Math.abs(item.cost)).toLocaleString('de')} ₫`;
          amountColor = 'var(--yes)';
        }

        return (
          <div key={item.id} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 20px',
            borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            {coinColor ? (
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: coinColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>
                {m?.coin?.charAt(0)}
              </div>
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isWin ? 18 : 16 }}>
                {iconContent}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: isWin ? 600 : 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {marketLabel}
              </div>
              {subText && (
                <div style={{ fontSize: 12, color: isWin ? '#15803d' : 'var(--text-muted)', marginTop: 2, fontWeight: isWin ? 600 : 400 }}>
                  {subText}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: amountColor }}>{amountLabel}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{formatTime(item.created_at)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
