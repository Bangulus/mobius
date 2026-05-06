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
  start_price?: number;
  end_price?: number;
}

interface PortfolioEntry {
  market: MarketRow;
  einsatz: number;
  direction: 'yes' | 'no';
  auszahlung: number | null;
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

type TabType = 'positionen' | 'aktivitaet';
type SubTabType = 'aktiv' | 'geschlossen';

export default function ProfileView({ userId, displayName, avatarUrl, balance, onUsernameChange, onAvatarChange }: Props) {
  const [newUsername, setNewUsername]         = useState(displayName);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingUsername, setSavingUsername]   = useState(false);
  const [profileMessage, setProfileMessage]   = useState('');
  const [editingUsername, setEditingUsername] = useState(false);

  const [tab, setTab]       = useState<TabType>('positionen');
  const [subTab, setSubTab] = useState<SubTabType>('aktiv');

  const [allRows, setAllRows]               = useState<PortfolioEntry[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);

  const totalEinsatz    = allRows.reduce((s, r) => s + r.einsatz, 0);
  const totalAusbe      = allRows.filter(r => r.auszahlung !== null && r.auszahlung > 0).reduce((s, r) => s + (r.auszahlung ?? 0), 0);
  const offeneCount     = allRows.filter(r => !r.market.resolved).length;
  const geschlossen     = allRows.filter(r => r.market.resolved);
  const gewonnen        = geschlossen.filter(r => r.auszahlung !== null && r.auszahlung > 0);
  const groessterGewinn = gewonnen.length > 0 ? Math.max(...gewonnen.map(r => r.auszahlung ?? 0)) : 0;

  const aktiveRows      = allRows.filter(r => !r.market.resolved);
  const geschlosseneRows = allRows.filter(r => r.market.resolved);
  const displayRows     = subTab === 'aktiv' ? aktiveRows : geschlosseneRows;

  const loadPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    const trades: TradeRow[] = await dbGet('trades', `user_id=eq.${userId}&select=*&order=created_at.desc`);
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
        entryMap[trade.market_id] = { market, einsatz: 0, direction: dir, auszahlung: null };
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

  useEffect(() => {
    if (!userId) return;
    loadPortfolio();
  }, [userId, loadPortfolio]);

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
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: 16,
        marginBottom: 24,
      }}>
        {/* Linke Seite: Avatar + Stats */}
        <div className="card" style={{ padding: '28px 28px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 24 }}>
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, border: '2px solid var(--border)' }}>
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name + Meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                {editingUsername ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') saveUsername(); if (e.key === 'Escape') setEditingUsername(false); }}
                      style={{ fontSize: 20, fontWeight: 700, padding: '4px 10px', borderRadius: 8, border: '1.5px solid var(--accent)', background: 'var(--surface)', color: 'var(--text)', width: 200 }}
                    />
                    <button onClick={saveUsername} disabled={savingUsername}
                      style={{ padding: '4px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      {savingUsername ? '…' : 'Speichern'}
                    </button>
                    <button onClick={() => setEditingUsername(false)}
                      style={{ padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{displayName}</span>
                    <button onClick={() => setEditingUsername(true)}
                      title="Name ändern"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px', fontSize: 14, lineHeight: 1, borderRadius: 4, display: 'flex', alignItems: 'center' }}>
                      ✎
                    </button>
                  </>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
                <span>Guthaben: <strong style={{ color: 'var(--yes)' }}>{(balance ?? 0).toLocaleString('de')} ₫</strong></span>
                <span>·</span>
                <span>{allRows.length} Prognosen</span>
              </div>
              {profileMessage && (
                <div style={{ marginTop: 8, fontSize: 12, color: profileMessage.startsWith('Fehler') ? 'var(--no)' : 'var(--yes)' }}>
                  {profileMessage}
                </div>
              )}
            </div>

            {/* Avatar-Upload */}
            <label style={{ fontSize: 12, padding: '6px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer', color: 'var(--text)', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {uploadingAvatar ? 'Lädt…' : 'Bild ändern'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadAvatar(e.target.files[0]); }} />
            </label>
          </div>

          {/* Kennzahlen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            {[
              { label: 'Portfoliowert', value: `${Math.round(balance ?? 0).toLocaleString('de')} ₫`, color: 'var(--text)' },
              { label: 'Größter Gewinn', value: groessterGewinn > 0 ? `+${Math.round(groessterGewinn).toLocaleString('de')} ₫` : '—', color: groessterGewinn > 0 ? 'var(--yes)' : 'var(--text-muted)' },
              { label: 'Prognosen', value: String(allRows.length), color: 'var(--text)' },
            ].map((s, i) => (
              <div key={s.label} style={{ paddingLeft: i > 0 ? 20 : 0, borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Rechte Seite: Gewinn/Verlust-Card */}
        <div className="card" style={{ padding: '24px 24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--yes)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gewinn / Verlust</span>
            </div>
          </div>

          <div style={{ fontSize: 32, fontWeight: 800, color: totalAusbe - totalEinsatz >= 0 ? 'var(--yes)' : 'var(--no)', letterSpacing: '-1px', marginBottom: 4 }}>
            {totalAusbe - totalEinsatz >= 0 ? '+' : ''}{Math.round(totalAusbe - totalEinsatz).toLocaleString('de')} ₫
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>Gesamt</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'rgba(22,163,74,0.06)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Eingesetzt</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{Math.round(totalEinsatz).toLocaleString('de')} ₫</div>
            </div>
            <div style={{ background: 'rgba(22,163,74,0.06)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gewonnen</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--yes)' }}>+{Math.round(totalAusbe).toLocaleString('de')} ₫</div>
            </div>
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Offene Positionen</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{offeneCount}</span>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 20, display: 'flex', gap: 0 }}>
        {(['positionen', 'aktivitaet'] as TabType[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 20px',
              fontSize: 14, fontWeight: tab === t ? 700 : 500,
              color: tab === t ? 'var(--text)' : 'var(--text-muted)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 0.15s',
            }}>
            {t === 'positionen' ? 'Positionen' : 'Aktivität'}
          </button>
        ))}
      </div>

      {/* ── POSITIONEN ── */}
      {tab === 'positionen' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
            {(['aktiv', 'geschlossen'] as SubTabType[]).map(s => (
              <button key={s} onClick={() => setSubTab(s)}
                style={{
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
                    {['Markt', 'Tipp', 'Eingesetzt', 'Ergebnis', 'Auszahlung'].map((h, i) => (
                      <th key={h} style={{
                        textAlign: i === 0 ? 'left' : 'right',
                        fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                        padding: '12px 20px',
                        borderBottom: '1px solid var(--border)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((entry, idx) => {
                    const m = entry.market;
                    const isYes = entry.direction === 'yes';
                    const richtungLabel = m.is_auto ? (isYes ? '↑ Up' : '↓ Down') : (isYes ? 'Ja' : 'Nein');
                    const resolved = m.resolved;
                    const won = resolved && entry.auszahlung !== null && entry.auszahlung > 0;
                    const lost = resolved && entry.auszahlung === 0;

                    return (
                      <tr key={entry.market.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)', borderBottom: '1px solid var(--border)' }}>
                        {/* Markt */}
                        <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text)', maxWidth: 320 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {m.is_auto && m.coin && (
                              <span style={{ width: 28, height: 28, borderRadius: 8, background: COIN_COLORS[m.coin] ?? '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                                {m.coin.charAt(0)}
                              </span>
                            )}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 260 }}>
                              {m.is_auto ? `${m.coin} · 3-Minuten-Markt` : m.question}
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
                            <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: m.resolution === 'yes' ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)', color: m.resolution === 'yes' ? '#15803d' : '#b91c1c' }}>
                              {m.is_auto ? (m.resolution === 'yes' ? 'Up ↑' : 'Down ↓') : (m.resolution === 'yes' ? 'Ja' : 'Nein')}
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

const COIN_COLORS_FEED: Record<string, string> = {
  BTC: '#f59e0b', ETH: '#6366f1', SOL: '#9945ff', XRP: '#00aae4',
};

interface FeedTrade {
  id: string;
  market_id: string;
  type: string;
  shares: number;
  cost: number;
  created_at: string;
  market?: {
    question: string;
    is_auto: boolean;
    coin?: string;
    resolved: boolean;
    resolution?: string;
  };
}

function AktivitaetsFeed({ userId }: { userId: string }) {
  const [trades, setTrades] = useState<FeedTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const raw: FeedTrade[] = await dbGet('trades', `user_id=eq.${userId}&select=*&order=created_at.desc&limit=50`);
      if (!raw || raw.length === 0) { setLoading(false); return; }

      const seen: Record<string, boolean> = {};
      const marketIds: string[] = [];
      raw.forEach(t => { if (!seen[t.market_id]) { seen[t.market_id] = true; marketIds.push(t.market_id); } });

      const markets = await dbGet('markets', `id=in.(${marketIds.join(',')})&select=id,question,is_auto,coin,resolved,resolution`);
      const mMap: Record<string, FeedTrade['market']> = {};
      markets?.forEach((m: { id: string; question: string; is_auto: boolean; coin?: string; resolved: boolean; resolution?: string }) => { mMap[m.id] = m; });

      setTrades(raw.map(t => ({ ...t, market: mMap[t.market_id] })));
      setLoading(false);
    }
    load();
  }, [userId]);

  function formatTime(iso: string) {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    const h   = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);
    if (min < 1)  return 'Gerade eben';
    if (min < 60) return `vor ${min} Min.`;
    if (h < 24)   return `vor ${h} Std.`;
    if (day < 7)  return `vor ${day} Tag${day > 1 ? 'en' : ''}`;
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  }

  function tradeText(t: FeedTrade): { main: string; sub: string; amountColor: string; amount: string } {
    const m = t.market;
    const isBuy  = t.type.startsWith('buy');
    const isSell = t.type.startsWith('sell');
    const isYes  = t.type.includes('yes');

    const marketLabel = m
      ? (m.is_auto ? `${m.coin} · 3-Min-Markt` : (m.question.length > 48 ? m.question.slice(0, 48) + '…' : m.question))
      : 'Unbekannter Markt';

    const dirLabel = m?.is_auto
      ? (isYes ? 'Up ↑' : 'Down ↓')
      : (isYes ? 'Ja' : 'Nein');

    if (isBuy) return {
      main: marketLabel,
      sub: `Gesetzt auf ${dirLabel}`,
      amountColor: 'var(--text)',
      amount: `–${Math.round(Math.abs(t.cost)).toLocaleString('de')} ₫`,
    };
    if (isSell) return {
      main: marketLabel,
      sub: `Verkauft · ${dirLabel}`,
      amountColor: 'var(--yes)',
      amount: `+${Math.round(Math.abs(t.cost)).toLocaleString('de')} ₫`,
    };
    return { main: marketLabel, sub: '', amountColor: 'var(--text)', amount: '' };
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 13 }}>Wird geladen…</div>
  );

  if (trades.length === 0) return (
    <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
      Noch keine Aktivität.
    </div>
  );

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {trades.map((t, idx) => {
        const { main, sub, amountColor, amount } = tradeText(t);
        const m = t.market;
        const coinColor = m?.is_auto && m.coin ? COIN_COLORS_FEED[m.coin] ?? '#f97316' : null;
        const isYes = t.type.includes('yes');
        const isBuy = t.type.startsWith('buy');

        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 20px',
            borderBottom: idx < trades.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            {/* Icon */}
            {coinColor ? (
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: coinColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>
                {m?.coin?.charAt(0)}
              </div>
            ) : (
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                background: isBuy
                  ? (isYes ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)')
                  : 'rgba(99,102,241,0.12)',
              }}>
                {isBuy ? (isYes ? '↑' : '↓') : '⇄'}
              </div>
            )}

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {main}
              </div>
              {sub && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
              )}
            </div>

            {/* Betrag + Zeit */}
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: amountColor }}>{amount}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{formatTime(t.created_at)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
