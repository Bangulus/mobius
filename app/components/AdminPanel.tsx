'use client';

import { useState, useEffect } from 'react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const COINS = [
  { id: 'BTC', label: '₿ Bitcoin', color: '#f59e0b' },
  { id: 'ETH', label: 'Ξ Ethereum', color: '#6366f1' },
  { id: 'SOL', label: '◎ Solana', color: '#9945ff' },
  { id: 'XRP', label: '✕ XRP', color: '#00aae4' },
];

const CATEGORIES = ['Politik', 'Sport', 'Krypto', 'Entertainment', 'Wirtschaft', 'Geopolitik', 'Finanzen', 'Wetter', 'Kultur'];

interface Props {
  userId: string;
  openMarkets: any[];
  onMarketResolved: () => void;
}

export default function AdminView({ userId, openMarkets, onMarketResolved }: Props) {
  const [adminTab, setAdminTab] = useState<'open' | 'resolved' | 'btc' | 'create'>('open');
  const [adminCategory, setAdminCategory] = useState('');
  const [resolvingMarket, setResolvingMarket] = useState<string | null>(null);
  const [resolvedMarketDetails, setResolvedMarketDetails] = useState<any[]>([]);
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);
  const [btcCreating, setBtcCreating] = useState(false);
  const [btcMessage, setBtcMessage] = useState('');
  const [btcMarkets, setBtcMarkets] = useState<any[]>([]);
  const [resolvingBtc, setResolvingBtc] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Neuer Markt Form State
  const [newQuestion, setNewQuestion]       = useState('');
  const [newShortLabel, setNewShortLabel]   = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory]       = useState('Politik');
  const [newClosesAt, setNewClosesAt]       = useState('');
  const [newB, setNewB]                     = useState(100);
  const [newGroupTitle, setNewGroupTitle]   = useState('');
  const [createLoading, setCreateLoading]   = useState(false);
  const [createMessage, setCreateMessage]   = useState('');

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (adminTab === 'btc') loadBtcMarkets();
  }, [adminTab]);

  async function loadBtcMarkets() {
    const res = await fetch(`${supabaseUrl}/rest/v1/markets?is_auto=eq.true&select=*&order=created_at.desc`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    setBtcMarkets(await res.json());
  }

  async function createCryptoMarket(coin: string) {
    setBtcCreating(true);
    setBtcMessage('');
    const res = await fetch('/api/create-crypto-market', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coin }),
    });
    const data = await res.json();
    if (data.success) {
      setBtcMessage(`✅ ${coin}-Markt erstellt! Startpreis: $${Number(data.startPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      loadBtcMarkets();
      onMarketResolved();
    } else {
      setBtcMessage(`❌ Fehler: ${data.error}`);
    }
    setBtcCreating(false);
  }

  async function resolveCryptoMarket(marketId: string) {
    setResolvingBtc(marketId);
    setBtcMessage('');
    const res = await fetch('/api/resolve-crypto-market', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ market_id: marketId }),
    });
    const data = await res.json();
    if (data.success) {
      const dir = data.resolution === 'yes' ? '📈 GESTIEGEN' : '📉 GEFALLEN';
      setBtcMessage(`✅ Aufgelöst: $${Number(data.start_price).toLocaleString()} → $${Number(data.end_price).toLocaleString()} · ${dir}`);
      loadBtcMarkets();
      onMarketResolved();
    } else {
      setBtcMessage(`❌ Fehler: ${data.error ?? data.message}`);
    }
    setResolvingBtc(null);
  }

  async function handleCreateMarket() {
    if (!newQuestion.trim()) { setCreateMessage('❌ Frage ist Pflichtfeld.'); return; }
    if (!newClosesAt) { setCreateMessage('❌ Schlussdatum ist Pflichtfeld.'); return; }

    setCreateLoading(true);
    setCreateMessage('');

    const body: any = {
      question:    newQuestion.trim(),
      short_label: newShortLabel.trim() || newQuestion.trim().slice(0, 60),
      description: newDescription.trim() || null,
      category:    newCategory,
      status:      'open',
      b:           newB,
      q_yes:       0,
      q_no:        0,
      closes_at:   new Date(newClosesAt).toISOString(),
      resolved:    false,
      is_auto:     false,
    };
    if (newGroupTitle.trim()) body.group_title = newGroupTitle.trim();

    const res = await fetch(`${supabaseUrl}/rest/v1/markets`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setCreateMessage('✅ Markt erstellt!');
      setNewQuestion(''); setNewShortLabel(''); setNewDescription('');
      setNewCategory('Politik'); setNewClosesAt(''); setNewB(100); setNewGroupTitle('');
      onMarketResolved();
    } else {
      const err = await res.text();
      setCreateMessage(`❌ Fehler: ${err}`);
    }
    setCreateLoading(false);
  }

  function formatCountdown(closesAt: string) {
    const diff = new Date(closesAt).getTime() - now;
    if (diff <= 0) return '⏰ Abgelaufen';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  const adminCategories = Array.from(new Set(openMarkets.map((m: any) => m.category).filter(Boolean))) as string[];
  const adminFilteredMarkets = adminCategory === '' ? openMarkets : openMarkets.filter((m: any) => m.category === adminCategory);

  function groupMarkets(markets: any[]) {
    const groups: { [key: string]: any[] } = {};
    markets.forEach((market) => {
      const key = market.group_title || '__ungrouped__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(market);
    });
    return groups;
  }

  const adminGrouped = groupMarkets(adminFilteredMarkets);

  async function resolveMarket(marketId: string, resolution: 'yes' | 'no') {
    setResolvingMarket(marketId);
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/resolve_market`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ market_id: marketId, resolution }),
    });
    if (response.ok) onMarketResolved();
    setResolvingMarket(null);
  }

  async function loadResolvedMarketDetails() {
    const closedMarketsResponse = await fetch(
      `${supabaseUrl}/rest/v1/markets?resolved=eq.true&select=*&order=created_at.desc`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const closedMarkets = await closedMarketsResponse.json();
    const tradesResponse = await fetch(
      `${supabaseUrl}/rest/v1/trades?select=*`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const allTrades = await tradesResponse.json();
    const usersResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?select=id,username`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const allUsers = await usersResponse.json();
    const usersMap: { [key: string]: string } = {};
    allUsers.forEach((u: any) => { usersMap[u.id] = u.username; });
    const details = closedMarkets.map((market: any) => {
      const marketTrades = allTrades.filter((t: any) => t.market_id === market.id);
      const winningType = market.resolution === 'yes' ? 'buy_yes' : 'buy_no';
      const tradeDetails = marketTrades.map((t: any) => ({
        username: usersMap[t.user_id] || 'Unbekannt',
        type: t.type,
        cost: t.cost,
        won: t.type === winningType,
        payout: t.type === winningType ? t.shares : 0,
      }));
      return { ...market, tradeDetails };
    });
    setResolvedMarketDetails(details);
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 14,
    color: 'var(--text)',
    background: 'var(--bg)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: 6,
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };

  const tabBtn = (active: boolean, accent = '#7c3aed') => ({
    padding: '8px 18px',
    background: active ? accent : 'var(--surface)',
    color: active ? 'white' : 'var(--text-muted)',
    border: `1px solid ${active ? accent : 'var(--border)'}`,
    borderRadius: 8,
    cursor: 'pointer' as const,
    fontSize: 13,
    fontWeight: 600,
  });

  return (
    <div>
      {/* ── Tab Bar ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button style={tabBtn(adminTab === 'open')}              onClick={() => setAdminTab('open')}>Offene Märkte</button>
        <button style={tabBtn(adminTab === 'resolved')}          onClick={() => { setAdminTab('resolved'); loadResolvedMarketDetails(); }}>Aufgelöste Märkte</button>
        <button style={tabBtn(adminTab === 'btc', '#f59e0b')}    onClick={() => setAdminTab('btc')}>🪙 Krypto-Märkte</button>
        <button style={tabBtn(adminTab === 'create', '#16a34a')} onClick={() => setAdminTab('create')}>＋ Markt erstellen</button>
      </div>

      {/* ── Markt erstellen ── */}
      {adminTab === 'create' && (
        <div style={{ maxWidth: 600 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>Neuen Markt erstellen</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div>
                <label style={labelStyle}>Frage *</label>
                <input
                  style={inputStyle}
                  placeholder="z.B. Wird Bitcoin 2026 auf 200.000$ steigen?"
                  value={newQuestion}
                  onChange={e => setNewQuestion(e.target.value)}
                  maxLength={300}
                />
              </div>

              <div>
                <label style={labelStyle}>Kurztitel (optional)</label>
                <input
                  style={inputStyle}
                  placeholder="z.B. BTC auf 200k?"
                  value={newShortLabel}
                  onChange={e => setNewShortLabel(e.target.value)}
                  maxLength={80}
                />
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 4 }}>Wird auf der Marktübersicht angezeigt. Falls leer: Frage wird gekürzt.</div>
              </div>

              <div>
                <label style={labelStyle}>Beschreibung (optional)</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                  placeholder="Zusätzliche Infos, Auflösungskriterien…"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  maxLength={1000}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Kategorie</label>
                  <select style={inputStyle} value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Liquiditätsparameter b</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={10}
                    max={10000}
                    value={newB}
                    onChange={e => setNewB(Math.max(10, parseInt(e.target.value) || 100))}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 4 }}>100 = Standard. Höher = flachere Preiskurve.</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Schließt am *</label>
                  <input
                    style={inputStyle}
                    type="datetime-local"
                    value={newClosesAt}
                    onChange={e => setNewClosesAt(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Gruppe (optional)</label>
                  <input
                    style={inputStyle}
                    placeholder="z.B. WM 2026"
                    value={newGroupTitle}
                    onChange={e => setNewGroupTitle(e.target.value)}
                    maxLength={80}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 4 }}>Märkte mit gleicher Gruppe werden zusammengefasst.</div>
                </div>
              </div>

              {createMessage && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: createMessage.startsWith('✅') ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
                  color: createMessage.startsWith('✅') ? '#16a34a' : '#dc2626',
                  fontSize: 13,
                  fontWeight: 600,
                }}>
                  {createMessage}
                </div>
              )}

              <button
                onClick={handleCreateMarket}
                disabled={createLoading}
                style={{
                  padding: '12px',
                  background: createLoading ? 'var(--surface)' : '#16a34a',
                  color: createLoading ? 'var(--text-muted)' : 'white',
                  border: 'none',
                  borderRadius: 10,
                  cursor: createLoading ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {createLoading ? 'Wird erstellt…' : 'Markt erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Krypto-Märkte ── */}
      {adminTab === 'btc' && (
        <div>
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Neuen 3-Minuten Krypto-Markt starten</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COINS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => createCryptoMarket(c.id)}
                  disabled={btcCreating}
                  style={{ padding: '8px 16px', background: c.color, color: 'white', border: 'none', borderRadius: 8, cursor: btcCreating ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: btcCreating ? 0.6 : 1 }}
                >
                  {btcCreating ? '⏳' : c.label}
                </button>
              ))}
            </div>
            {btcMessage && (
              <div style={{ marginTop: 10, fontSize: 13, color: btcMessage.startsWith('✅') ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                {btcMessage}
              </div>
            )}
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Laufende & vergangene Krypto-Märkte</div>
          {btcMarkets.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Noch keine Krypto-Märkte erstellt.</div>}
          {btcMarkets.map((market: any) => {
            const isOpen = !market.resolved;
            const expired = new Date(market.closes_at).getTime() < now;
            const coinData = COINS.find(c => c.id === (market.coin ?? 'BTC'));
            return (
              <div key={market.id} className="card" style={{ padding: '12px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: coinData?.color ?? '#888', color: 'white', fontSize: 11, fontWeight: 700 }}>
                      {market.coin ?? 'BTC'}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{market.short_label}</span>
                  </div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: isOpen ? 'rgba(22,163,74,0.1)' : 'var(--surface)', color: isOpen ? '#16a34a' : 'var(--text-muted)', fontWeight: 600 }}>
                    {isOpen ? 'Offen' : `${market.resolution?.toUpperCase()}`}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16, marginBottom: isOpen ? 10 : 0 }}>
                  <span>Start: ${Number(market.start_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  {market.end_price && <span>End: ${Number(market.end_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                  {isOpen && <span style={{ fontWeight: 700, color: expired ? '#dc2626' : '#f59e0b' }}>{formatCountdown(market.closes_at)}</span>}
                </div>
                {isOpen && (
                  <button
                    onClick={() => resolveCryptoMarket(market.id)}
                    disabled={resolvingBtc === market.id}
                    style={{ padding: '4px 12px', background: expired ? '#dc2626' : 'var(--surface)', color: expired ? 'white' : 'var(--text-muted)', border: `1px solid ${expired ? '#dc2626' : 'var(--border)'}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                  >
                    {resolvingBtc === market.id ? '⏳ Wird aufgelöst…' : expired ? '⚡ Jetzt auflösen' : '🔧 Manuell auflösen'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Offene Märkte ── */}
      {adminTab === 'open' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={() => setAdminCategory('')} style={{ padding: '4px 12px', background: adminCategory === '' ? '#7c3aed' : 'var(--surface)', color: adminCategory === '' ? 'white' : 'var(--text-muted)', border: `1px solid ${adminCategory === '' ? '#7c3aed' : 'var(--border)'}`, borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Alle</button>
            {adminCategories.map((cat) => (
              <button key={cat} onClick={() => setAdminCategory(cat)} style={{ padding: '4px 12px', background: adminCategory === cat ? '#7c3aed' : 'var(--surface)', color: adminCategory === cat ? 'white' : 'var(--text-muted)', border: `1px solid ${adminCategory === cat ? '#7c3aed' : 'var(--border)'}`, borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{cat}</button>
            ))}
          </div>
          {Object.entries(adminGrouped).map(([groupTitle, groupMarkets]) => (
            <div key={groupTitle} style={{ marginBottom: 16 }}>
              {groupTitle !== '__ungrouped__' && (
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, padding: '4px 10px', background: '#7c3aed', color: 'white', borderRadius: 6, display: 'inline-block' }}>
                  {groupTitle}
                </div>
              )}
              {groupMarkets.map((market: any) => (
                <div key={market.id} style={{ border: '1px solid var(--border)', padding: '10px 14px', marginBottom: 6, borderRadius: 8, background: 'var(--card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)', flex: 1 }}>{market.short_label || market.question}</div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => resolveMarket(market.id, 'yes')} disabled={resolvingMarket === market.id} style={{ padding: '4px 12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✓ YES</button>
                    <button onClick={() => resolveMarket(market.id, 'no')}  disabled={resolvingMarket === market.id} style={{ padding: '4px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✗ NO</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Aufgelöste Märkte ── */}
      {adminTab === 'resolved' && (
        <div>
          {resolvedMarketDetails.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Noch keine aufgelösten Märkte.</div>}
          {resolvedMarketDetails.map((market: any) => (
            <div key={market.id} style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
              <div
                onClick={() => setExpandedMarket(expandedMarket === market.id ? null : market.id)}
                style={{ padding: '10px 14px', background: market.resolution === 'yes' ? '#16a34a' : '#dc2626', color: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{market.short_label || market.question}</div>
                  <div style={{ fontSize: 12, marginTop: 2, opacity: 0.85 }}>Ergebnis: {market.resolution === 'yes' ? '✓ YES' : '✗ NO'} · {market.tradeDetails.length} Trades</div>
                </div>
                <span style={{ fontSize: 12 }}>{expandedMarket === market.id ? '▲' : '▼'}</span>
              </div>
              {expandedMarket === market.id && (
                <div style={{ background: 'var(--card)' }}>
                  {market.tradeDetails.length === 0 && <div style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 13 }}>Keine Trades.</div>}
                  {market.tradeDetails.map((t: any, i: number) => (
                    <div key={i} style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{t.username}</span>
                        <span style={{ background: t.type === 'buy_yes' ? '#16a34a' : '#dc2626', color: 'white', padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          {t.type === 'buy_yes' ? 'YES' : t.type === 'buy_no' ? 'NO' : t.type === 'sell_yes' ? 'SELL YES' : 'SELL NO'}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 12 }}>
                        <div style={{ color: 'var(--text-muted)' }}>{Number(Math.abs(t.cost)).toFixed(0)} ₫</div>
                        {t.won
                          ? <div style={{ color: '#16a34a', fontWeight: 700 }}>+{Number(t.payout).toFixed(0)} ₫ 🎉</div>
                          : <div style={{ color: '#dc2626' }}>Verloren</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
