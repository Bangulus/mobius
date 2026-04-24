'use client';

import { useState, useEffect } from 'react';

const SUPABASE_URL = 'https://zrujclkigcrlrvpgxrqx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydWpjbGtpZ2NybHJ2cGd4cnF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQ0NTEsImV4cCI6MjA5MTQwMDQ1MX0.JpuZxskptogAKtw5cUR3gJOAcnh3BFh1NSvfVEtN8IQ';

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
  auszahlung: number | null; // null = offen
}

const COIN_COLORS: Record<string, string> = {
  BTC: '#f59e0b', ETH: '#6366f1', SOL: '#9945ff', XRP: '#00aae4',
};

export default function ProfileView({ userId, token, displayName, avatarUrl, balance, onUsernameChange, onAvatarChange }: Props) {
  const [newUsername, setNewUsername]     = useState(displayName);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingUsername, setSavingUsername]   = useState(false);
  const [profileMessage, setProfileMessage]   = useState('');

  const [kryptoRows, setKryptoRows]   = useState<PortfolioEntry[]>([]);
  const [manuelleRows, setManuelleRows] = useState<PortfolioEntry[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);

  // Kennzahlen
  const allRows     = [...kryptoRows, ...manuelleRows];
  const totalEinsatz = allRows.reduce((s, r) => s + r.einsatz, 0);
  const totalAusbe   = allRows.filter(r => r.auszahlung !== null && r.auszahlung > 0).reduce((s, r) => s + (r.auszahlung ?? 0), 0);
  const offene       = allRows.filter(r => r.auszahlung === null).length;

  useEffect(() => {
    if (!userId) return;
    loadPortfolio();
  }, [userId]);

  async function loadPortfolio() {
    setPortfolioLoading(true);
    // Alle Trades des Users laden
    const trades: TradeRow[] = await dbGet('trades', `user_id=eq.${userId}&select=*&order=created_at.desc`);
    if (!trades || trades.length === 0) { setPortfolioLoading(false); return; }

    // Eindeutige Market-IDs
    const marketIds = [...new Set(trades.map(t => t.market_id))];
    const markets: MarketRow[] = await dbGet('markets', `id=in.(${marketIds.join(',')})&select=*`);
    const marketMap = Object.fromEntries(markets.map(m => [m.id, m]));

    // Pro Markt: letzten Kauf aggregieren
    const entryMap: Record<string, PortfolioEntry> = {};

    for (const trade of trades) {
      const market = marketMap[trade.market_id];
      if (!market) continue;

      const isBuy  = trade.type === 'buy_yes' || trade.type === 'buy_no';
      const isSell = trade.type === 'sell_yes' || trade.type === 'sell_no';
      const dir: 'yes' | 'no' = trade.type.includes('yes') ? 'yes' : 'no';

      if (!entryMap[trade.market_id]) {
        entryMap[trade.market_id] = {
          market,
          einsatz: 0,
          direction: dir,
          auszahlung: null,
        };
      }

      const entry = entryMap[trade.market_id];

      if (isBuy)  entry.einsatz += Math.abs(trade.cost);
      if (isSell) {
        // Verkauf während Markt offen: Rückgabe als Auszahlung
        entry.auszahlung = (entry.auszahlung ?? 0) + Math.abs(trade.cost);
      }

      // Letzter Trade bestimmt Richtung
      if (isBuy) entry.direction = dir;
    }

    // Gewinn-Auszahlung: shares aus buy_yes/buy_no wenn Markt resolved
    for (const entry of Object.values(entryMap)) {
      const m = entry.market;
      if (!m.resolved) continue;
      if (entry.auszahlung !== null) continue; // bereits Verkauf verbucht

      // Gewonnen?
      const won = (m.resolution === 'yes' && entry.direction === 'yes') ||
                  (m.resolution === 'no'  && entry.direction === 'no');

      if (won) {
        // Shares aus Trades berechnen
        const mTrades = trades.filter(t => t.market_id === m.id && (t.type === 'buy_yes' || t.type === 'buy_no'));
        const totalShares = mTrades.reduce((s, t) => s + (t.shares ?? 0), 0);
        entry.auszahlung = Math.round(totalShares);
      } else {
        entry.auszahlung = 0; // verloren
      }
    }

    const allEntries = Object.values(entryMap).sort((a, b) =>
      new Date(b.market.id).getTime() - new Date(a.market.id).getTime()
    );

    setKryptoRows(allEntries.filter(e => e.market.is_auto));
    setManuelleRows(allEntries.filter(e => !e.market.is_auto));
    setPortfolioLoading(false);
  }

  async function saveUsername() {
    if (!newUsername.trim()) return;
    setSavingUsername(true);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ username: newUsername.trim() }),
    });
    if (res.ok) {
      onUsernameChange(newUsername.trim());
      setProfileMessage('Gespeichert ✓');
    } else {
      setProfileMessage('Fehler beim Speichern.');
    }
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

  function AuszahlungCell({ entry }: { entry: PortfolioEntry }) {
    if (!entry.market.resolved && entry.auszahlung === null) {
      return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>ausstehend</span>;
    }
    if (entry.auszahlung === null || entry.auszahlung === 0) {
      return <span style={{ color: 'var(--no)', fontWeight: 600 }}>–{Math.round(entry.einsatz)} ₫</span>;
    }
    return <span style={{ color: 'var(--yes)', fontWeight: 600 }}>+{Math.round(entry.auszahlung)} ₫</span>;
  }

  function ErgebnisCell({ entry }: { entry: PortfolioEntry }) {
    const m = entry.market;
    if (!m.resolved) {
      return <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(245,158,11,0.12)', color: '#b45309', fontWeight: 600 }}>Läuft</span>;
    }
    const label = m.is_auto
      ? (m.resolution === 'yes' ? 'Up ↑' : 'Down ↓')
      : (m.resolution === 'yes' ? 'Ja' : 'Nein');
    const isYes = m.resolution === 'yes';
    return (
      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: isYes ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)', color: isYes ? '#15803d' : '#b91c1c' }}>
        {label}
      </span>
    );
  }

  function RichtungCell({ entry }: { entry: PortfolioEntry }) {
    const isYes = entry.direction === 'yes';
    const label = entry.market.is_auto ? (isYes ? '↑ Up' : '↓ Down') : (isYes ? 'Ja' : 'Nein');
    return (
      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: isYes ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)', color: isYes ? '#15803d' : '#b91c1c' }}>
        {label}
      </span>
    );
  }

  const thStyle: React.CSSProperties = {
    textAlign: 'left', fontSize: 11, fontWeight: 600,
    color: 'var(--text-muted)', padding: '0 0 8px',
    borderBottom: '1px solid var(--border)',
  };
  const tdStyle: React.CSSProperties = {
    padding: '10px 0', fontSize: 13,
    borderBottom: '1px solid var(--border)',
    color: 'var(--text)', verticalAlign: 'middle',
  };

  return (
    <div style={{ maxWidth: 680 }}>

      {/* Profil-Card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
              👤
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{displayName}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Guthaben: <strong style={{ color: 'var(--yes)' }}>{(balance ?? 0).toLocaleString('de')} ₫</strong>
            </div>
          </div>
          <label style={{ fontSize: 12, padding: '6px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer', color: 'var(--text)', fontWeight: 600, flexShrink: 0 }}>
            {uploadingAvatar ? 'Lädt…' : 'Bild ändern'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadAvatar(e.target.files[0]); }} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            placeholder="Benutzername"
            style={{ flex: 1, fontSize: 14, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
          />
          <button
            onClick={saveUsername}
            disabled={savingUsername}
            style={{ padding: '8px 18px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}
          >
            {savingUsername ? '…' : 'Speichern'}
          </button>
        </div>
        {profileMessage && (
          <div style={{ marginTop: 10, fontSize: 13, color: profileMessage.startsWith('Fehler') ? 'var(--no)' : 'var(--yes)' }}>
            {profileMessage}
          </div>
        )}
      </div>

      {/* Portfolio */}
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Meine Wetten</div>

      {/* Kennzahlen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Gesamt eingesetzt', value: `${Math.round(totalEinsatz).toLocaleString('de')} ₫`, color: 'var(--text)' },
          { label: 'Ausbezahlt', value: `+${Math.round(totalAusbe).toLocaleString('de')} ₫`, color: 'var(--yes)' },
          { label: 'Offene Positionen', value: String(offene), color: 'var(--text)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {portfolioLoading ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>Wird geladen…</div>
      ) : allRows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
          Noch keine Wetten platziert.
        </div>
      ) : (
        <>
          {/* Krypto */}
          {kryptoRows.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Krypto-Märkte</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(249,115,22,0.12)', color: '#c2410c', fontWeight: 600 }}>Up / Down</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{kryptoRows.length} Märkte</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Markt', 'Einsatz', 'Tipp', 'Ergebnis', 'Auszahlung'].map((h, i) => (
                      <th key={h} style={{ ...thStyle, textAlign: i >= 1 ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kryptoRows.map(entry => (
                    <tr key={entry.market.id}>
                      <td style={tdStyle}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: COIN_COLORS[entry.market.coin ?? ''] ?? '#f97316', display: 'inline-block', marginRight: 6 }} />
                        <span style={{ fontWeight: 600 }}>{entry.market.coin}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: 12 }}>3min</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{Math.round(entry.einsatz)} ₫</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}><RichtungCell entry={entry} /></td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}><ErgebnisCell entry={entry} /></td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}><AuszahlungCell entry={entry} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Manuelle */}
          {manuelleRows.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Manuelle Märkte</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>Ja / Nein</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{manuelleRows.length} Märkte</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Frage', 'Einsatz', 'Tipp', 'Ergebnis', 'Auszahlung'].map((h, i) => (
                      <th key={h} style={{ ...thStyle, textAlign: i >= 1 ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {manuelleRows.map(entry => (
                    <tr key={entry.market.id}>
                      <td style={{ ...tdStyle, maxWidth: 200 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                          {entry.market.question}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{Math.round(entry.einsatz)} ₫</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}><RichtungCell entry={entry} /></td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}><ErgebnisCell entry={entry} /></td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}><AuszahlungCell entry={entry} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
