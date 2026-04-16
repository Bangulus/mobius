'use client';

import { useState, useEffect } from 'react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface Props {
  userId: string;
  openMarkets: any[];
  onMarketResolved: () => void;
}

export default function AdminView({ userId, openMarkets, onMarketResolved }: Props) {
  const [adminTab, setAdminTab] = useState<'open' | 'resolved' | 'btc'>('open');
  const [adminCategory, setAdminCategory] = useState('');
  const [resolvingMarket, setResolvingMarket] = useState<string | null>(null);
  const [resolvedMarketDetails, setResolvedMarketDetails] = useState<any[]>([]);
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);
  const [btcCreating, setBtcCreating] = useState(false);
  const [btcMessage, setBtcMessage] = useState('');
  const [btcMarkets, setBtcMarkets] = useState<any[]>([]);
  const [resolvingBtc, setResolvingBtc] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

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

  async function createBtcMarket() {
    setBtcCreating(true);
    setBtcMessage('');
    const res = await fetch('/api/create-btc-market', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setBtcMessage(`✅ Markt erstellt! Startpreis: $${data.startPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      loadBtcMarkets();
      onMarketResolved();
    } else {
      setBtcMessage(`❌ Fehler: ${data.error}`);
    }
    setBtcCreating(false);
  }

  async function resolveBtcMarket(marketId: string) {
    setResolvingBtc(marketId);
    setBtcMessage('');
    const res = await fetch('/api/resolve-btc-market', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketId }),
    });
    const data = await res.json();
    if (data.success) {
      const dir = data.resolution === 'yes' ? '📈 GESTIEGEN' : '📉 GEFALLEN';
      setBtcMessage(`✅ Aufgelöst: $${Number(data.startPrice).toLocaleString()} → $${Number(data.endPrice).toLocaleString()} · ${dir}`);
      loadBtcMarkets();
      onMarketResolved();
    } else {
      setBtcMessage(`❌ Fehler: ${data.error}`);
    }
    setResolvingBtc(null);
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
      `${supabaseUrl}/rest/v1/markets?status=eq.closed&select=*`,
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
        payout: t.type === winningType ? t.cost * 2 : 0,
      }));
      return { ...market, tradeDetails };
    });
    setResolvedMarketDetails(details);
  }

  return (
    <div>
      <h2>⚙️ Admin</h2>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button onClick={() => setAdminTab('open')} style={{ padding: '0.5rem 1.5rem', background: adminTab === 'open' ? '#7c3aed' : '#eee', color: adminTab === 'open' ? 'white' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}>
          Offene Märkte
        </button>
        <button onClick={() => { setAdminTab('resolved'); loadResolvedMarketDetails(); }} style={{ padding: '0.5rem 1.5rem', background: adminTab === 'resolved' ? '#7c3aed' : '#eee', color: adminTab === 'resolved' ? 'white' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}>
          Aufgelöste Märkte
        </button>
        <button onClick={() => setAdminTab('btc')} style={{ padding: '0.5rem 1.5rem', background: adminTab === 'btc' ? '#f59e0b' : '#eee', color: adminTab === 'btc' ? 'white' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}>
          ₿ BTC-Märkte
        </button>
      </div>

      {adminTab === 'btc' && (
        <div>
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Neuen 15-Minuten BTC-Markt starten</h3>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
              Holt aktuellen BTC/USD-Preis von Binance, erstellt Markt und startet 15-Minuten-Timer.
            </p>
            <button
              onClick={createBtcMarket}
              disabled={btcCreating}
              style={{ padding: '0.6rem 1.5rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
            >
              {btcCreating ? '⏳ Wird erstellt...' : '₿ BTC-Markt starten'}
            </button>
            {btcMessage && (
              <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: btcMessage.startsWith('✅') ? '#16a34a' : '#dc2626' }}>
                {btcMessage}
              </p>
            )}
          </div>

          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Laufende & vergangene BTC-Märkte</h3>
          {btcMarkets.length === 0 && <p style={{ color: '#666', fontSize: '0.9rem' }}>Noch keine BTC-Märkte erstellt.</p>}
          {btcMarkets.map((market: any) => {
            const isOpen = market.status === 'open';
            const expired = new Date(market.closes_at).getTime() < now;
            return (
              <div key={market.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1rem', marginBottom: '0.75rem', background: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{market.short_label}</div>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '20px', background: isOpen ? '#dcfce7' : '#f3f4f6', color: isOpen ? '#16a34a' : '#666' }}>
                    {isOpen ? 'Offen' : `Aufgelöst: ${market.resolution?.toUpperCase()}`}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666', display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                  <span>Start: ${Number(market.start_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  {market.end_price && <span>End: ${Number(market.end_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                  {isOpen && <span style={{ fontWeight: 'bold', color: expired ? '#dc2626' : '#f59e0b' }}>{formatCountdown(market.closes_at)}</span>}
                </div>
                {isOpen && (
                  <button
                    onClick={() => resolveBtcMarket(market.id)}
                    disabled={resolvingBtc === market.id}
                    style={{ padding: '0.3rem 1rem', background: expired ? '#dc2626' : '#64748b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    {resolvingBtc === market.id ? '⏳ Wird aufgelöst...' : expired ? '⚡ Jetzt auflösen' : '🔧 Manuell auflösen'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {adminTab === 'open' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => setAdminCategory('')} style={{ padding: '0.3rem 1rem', background: adminCategory === '' ? '#7c3aed' : '#f3f4f6', color: adminCategory === '' ? 'white' : '#333', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '0.9rem' }}>Alle</button>
            {adminCategories.map((cat) => (
              <button key={cat} onClick={() => setAdminCategory(cat)} style={{ padding: '0.3rem 1rem', background: adminCategory === cat ? '#7c3aed' : '#f3f4f6', color: adminCategory === cat ? 'white' : '#333', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '0.9rem' }}>{cat}</button>
            ))}
          </div>
          {Object.entries(adminGrouped).map(([groupTitle, groupMarkets]) => (
            <div key={groupTitle} style={{ marginBottom: '1.5rem' }}>
              {groupTitle !== '__ungrouped__' && (
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.5rem', padding: '0.3rem 0.75rem', background: '#7c3aed', color: 'white', borderRadius: '6px' }}>
                  {groupTitle}
                </h3>
              )}
              {groupMarkets.map((market: any) => (
                <div key={market.id} style={{ border: '1px solid #ccc', padding: '0.75rem 1rem', marginBottom: '0.5rem', borderRadius: '8px', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{market.short_label || market.question}</div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => resolveMarket(market.id, 'yes')} disabled={resolvingMarket === market.id} style={{ padding: '0.2rem 0.75rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>✓ YES</button>
                    <button onClick={() => resolveMarket(market.id, 'no')} disabled={resolvingMarket === market.id} style={{ padding: '0.2rem 0.75rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>✗ NO</button>
                    {resolvingMarket === market.id && <span style={{ fontSize: '0.85rem', color: '#666' }}>...</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {adminTab === 'resolved' && (
        <div>
          {resolvedMarketDetails.length === 0 && <p>Noch keine aufgelösten Märkte.</p>}
          {resolvedMarketDetails.map((market: any) => (
            <div key={market.id} style={{ border: '1px solid #ccc', borderRadius: '10px', marginBottom: '0.75rem', background: 'white', overflow: 'hidden' }}>
              <div onClick={() => setExpandedMarket(expandedMarket === market.id ? null : market.id)} style={{ padding: '0.75rem 1rem', background: market.resolution === 'yes' ? '#16a34a' : '#dc2626', color: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{market.short_label || market.question}</div>
                  <div style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>Ergebnis: {market.resolution === 'yes' ? '✓ YES' : '✗ NO'} · {market.tradeDetails.length} Trades</div>
                </div>
                <span style={{ fontSize: '1.2rem' }}>{expandedMarket === market.id ? '▲' : '▼'}</span>
              </div>
              {expandedMarket === market.id && (
                <div>
                  {market.tradeDetails.length === 0 && <div style={{ padding: '1rem', color: '#666', fontSize: '0.85rem' }}>Keine Trades für diesen Markt.</div>}
                  {market.tradeDetails.map((t: any, i: number) => (
                    <div key={i} style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{t.username}</span>
                        <span style={{ background: t.type === 'buy_yes' ? '#16a34a' : '#dc2626', color: 'white', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>{t.type === 'buy_yes' ? 'YES' : 'NO'}</span>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                        <div style={{ color: '#666' }}>Einsatz: {Number(t.cost).toFixed(2)} D</div>
                        {t.won ? <div style={{ color: '#16a34a', fontWeight: 'bold' }}>+{Number(t.payout).toFixed(2)} D 🎉</div> : <div style={{ color: '#dc2626' }}>Verloren</div>}
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
