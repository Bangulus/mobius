'use client';

import { useState } from 'react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface Props {
  userId: string;
  openMarkets: any[];
  onMarketResolved: () => void;
}

export default function AdminView({ userId, openMarkets, onMarketResolved }: Props) {
  const [adminTab, setAdminTab] = useState<'open' | 'resolved'>('open');
  const [adminCategory, setAdminCategory] = useState('');
  const [resolvingMarket, setResolvingMarket] = useState<string | null>(null);
  const [resolvedMarketDetails, setResolvedMarketDetails] = useState<any[]>([]);
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);

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
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setAdminTab('open')} style={{ padding: '0.5rem 1.5rem', background: adminTab === 'open' ? '#7c3aed' : '#eee', color: adminTab === 'open' ? 'white' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}>
          Offene Märkte
        </button>
        <button onClick={() => { setAdminTab('resolved'); loadResolvedMarketDetails(); }} style={{ padding: '0.5rem 1.5rem', background: adminTab === 'resolved' ? '#7c3aed' : '#eee', color: adminTab === 'resolved' ? 'white' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}>
          Aufgelöste Märkte
        </button>
      </div>

      {adminTab === 'open' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <button onClick={() => setAdminCategory('')} style={{ padding: '0.3rem 1rem', background: adminCategory === '' ? '#7c3aed' : '#f3f4f6', color: adminCategory === '' ? 'white' : '#333', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '0.9rem' }}>
              Alle
            </button>
            {adminCategories.map((cat) => (
              <button key={cat} onClick={() => setAdminCategory(cat)} style={{ padding: '0.3rem 1rem', background: adminCategory === cat ? '#7c3aed' : '#f3f4f6', color: adminCategory === cat ? 'white' : '#333', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '0.9rem' }}>
                {cat}
              </button>
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
                    <button onClick={() => resolveMarket(market.id, 'yes')} disabled={resolvingMarket === market.id} style={{ padding: '0.2rem 0.75rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                      ✓ YES
                    </button>
                    <button onClick={() => resolveMarket(market.id, 'no')} disabled={resolvingMarket === market.id} style={{ padding: '0.2rem 0.75rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                      ✗ NO
                    </button>
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
                  <div style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
                    Ergebnis: {market.resolution === 'yes' ? '✓ YES' : '✗ NO'} · {market.tradeDetails.length} Trades
                  </div>
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
                        <span style={{ background: t.type === 'buy_yes' ? '#16a34a' : '#dc2626', color: 'white', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                          {t.type === 'buy_yes' ? 'YES' : 'NO'}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                        <div style={{ color: '#666' }}>Einsatz: {Number(t.cost).toFixed(2)} D</div>
                        {t.won ? (
                          <div style={{ color: '#16a34a', fontWeight: 'bold' }}>+{Number(t.payout).toFixed(2)} D 🎉</div>
                        ) : (
                          <div style={{ color: '#dc2626' }}>Verloren</div>
                        )}
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