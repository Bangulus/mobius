'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function MarketPage() {
  const params = useParams();
  const router = useRouter();
  const marketId = params.id as string;

  const [market, setMarket] = useState<any>(null);
  const [groupMarkets, setGroupMarkets] = useState<any[]>([]);
  const [userId, setUserId] = useState('');
  const [token, setToken] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [einsatz, setEinsatz] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [selectedMarketId, setSelectedMarketId] = useState(marketId);

  useEffect(() => {
    const params2 = new URLSearchParams(window.location.search);
    const uid = params2.get('user_id');
    const tok = params2.get('token');
    if (uid && tok) {
      setUserId(uid);
      setToken(tok);
      loadUserData(uid);
    }
    loadMarket();
  }, [marketId]);

  async function loadMarket() {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/markets?id=eq.${marketId}&select=*`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const data = await response.json();
    if (data[0]) {
      setMarket(data[0]);
      setSelectedMarketId(data[0].id);
      if (data[0].group_title) {
        loadGroupMarkets(data[0].group_title);
      }
    }
  }

  async function loadGroupMarkets(groupTitle: string) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/markets?group_title=eq.${encodeURIComponent(groupTitle)}&status=eq.open&select=*`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const data = await response.json();
    setGroupMarkets(data);
  }

  async function loadUserData(uid: string) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${uid}&select=*`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const data = await response.json();
    if (data[0]) {
      setBalance(data[0].balance);
      setDisplayName(data[0].username);
    }
  }

  function calcProb(qY: number, qN: number, b: number) {
    const expYes = Math.exp(qY / b);
    const expNo = Math.exp(qN / b);
    return expYes / (expYes + expNo);
  }

  const selectedMarket = groupMarkets.find(m => m.id === selectedMarketId) || market;

  const prob = selectedMarket ? calcProb(selectedMarket.q_yes, selectedMarket.q_no, selectedMarket.b) : 0.5;
  const percentageYes = Math.round(prob * 100);
  const percentageNo = 100 - percentageYes;

  const newQYes = side === 'yes' ? (selectedMarket?.q_yes || 0) + einsatz : (selectedMarket?.q_yes || 0);
  const newQNo = side === 'no' ? (selectedMarket?.q_no || 0) + einsatz : (selectedMarket?.q_no || 0);
  const priceAfter = selectedMarket ? calcProb(newQYes, newQNo, selectedMarket.b) : 0.5;
  const cost = einsatz * ((prob + priceAfter) / 2);
  const gewinn = einsatz - cost;

  async function bet() {
    if (einsatz <= 0 || !userId) return;
    setLoading(true);
    setResult('');

    const priceBefore = prob;
    const response = await fetch(`${supabaseUrl}/rest/v1/trades`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        market_id: selectedMarketId,
        type: side === 'yes' ? 'buy_yes' : 'buy_no',
        shares: einsatz,
        cost,
        price_before: priceBefore,
        price_after: priceAfter,
        user_id: userId,
      }),
    });

    if (response.ok) {
      await fetch(`${supabaseUrl}/rest/v1/markets?id=eq.${selectedMarketId}`, {
        method: 'PATCH',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ q_yes: newQYes, q_no: newQNo }),
      });

      const userResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=balance`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      });
      const userData = await userResponse.json();
      const newBalance = (userData[0]?.balance || 0) - cost;
      await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ balance: newBalance }),
      });
      setBalance(newBalance);
      setResult('✓ Trade platziert!');
      loadMarket();
    } else {
      setResult('✗ Fehler beim Trade');
    }
    setLoading(false);
    setTimeout(() => setResult(''), 3000);
  }

  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const tokenParam = searchParams.get('token') ? `?token=${searchParams.get('token')}&user_id=${searchParams.get('user_id')}` : '';

  if (!market) return <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Lädt...</div>;

  return (
    <main style={{ fontFamily: 'sans-serif', background: '#f9fafb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => router.push(`/${tokenParam}`)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', fontWeight: 'bold', color: '#0f3460' }}
        >
          ← Möbius
        </button>
        {displayName && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 'bold' }}>👤 {displayName}</div>
            <div style={{ color: '#16a34a', fontWeight: 'bold' }}>💰 {balance?.toLocaleString('de-DE', { minimumFractionDigits: 2 })} D</div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 360px', gap: '2rem', alignItems: 'start' }}>
        {/* Links: Marktinfo */}
        <div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '2rem', marginBottom: '1.5rem', border: '1px solid #e5e7eb' }}>
            {market.group_title && (
              <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>{market.group_title}</div>
            )}
            <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '0 0 1rem', color: '#111' }}>
              {market.group_title || market.question}
            </h1>

            {/* Gruppenmarkt-Liste */}
            {groupMarkets.length > 1 && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold' }}>Option</span>
                  <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold', textAlign: 'center' }}>Wahrsch.</span>
                  <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold' }}></span>
                </div>
                {groupMarkets.map((gm: any) => {
                  const p = calcProb(gm.q_yes, gm.q_no, gm.b);
                  const pct = Math.round(p * 100);
                  const isSelected = gm.id === selectedMarketId;
                  return (
                    <div
                      key={gm.id}
                      onClick={() => { setSelectedMarketId(gm.id); setSide('yes'); setEinsatz(0); }}
                      style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem', alignItems: 'center', padding: '0.75rem', borderRadius: '8px', background: isSelected ? '#f0f9ff' : 'white', border: isSelected ? '1px solid #0f3460' : '1px solid #f3f4f6', marginBottom: '0.4rem', cursor: 'pointer' }}
                    >
                      <span style={{ fontWeight: isSelected ? 'bold' : 'normal', fontSize: '0.95rem' }}>{gm.short_label || gm.question}</span>
                      <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#111' }}>{pct}%</span>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedMarketId(gm.id); setSide('yes'); setEinsatz(0); }}
                          style={{ padding: '0.2rem 0.6rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                        >
                          Ja {pct}¢
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedMarketId(gm.id); setSide('no'); setEinsatz(0); }}
                          style={{ padding: '0.2rem 0.6rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                        >
                          Nein {100 - pct}¢
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Einzelmarkt */}
            {groupMarkets.length <= 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 'bold' }}>{percentageYes}%</span>
                <span style={{ color: '#888' }}>Wahrscheinlichkeit</span>
              </div>
            )}
          </div>
        </div>

        {/* Rechts: Trading Panel */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e5e7eb', position: 'sticky', top: '1rem' }}>
          {selectedMarket && (
            <div style={{ marginBottom: '1rem', fontWeight: 'bold', fontSize: '1rem', color: '#111' }}>
              {selectedMarket.short_label || selectedMarket.question}
            </div>
          )}

          {/* Ja/Nein */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button
              onClick={() => setSide('yes')}
              style={{ padding: '0.75rem', background: side === 'yes' ? '#16a34a' : '#f3f4f6', color: side === 'yes' ? 'white' : '#555', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
            >
              Ja {percentageYes}¢
            </button>
            <button
              onClick={() => setSide('no')}
              style={{ padding: '0.75rem', background: side === 'no' ? '#dc2626' : '#f3f4f6', color: side === 'no' ? 'white' : '#555', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
            >
              Nein {percentageNo}¢
            </button>
          </div>

          {/* Betrag */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#888' }}>Betrag</div>
                <div style={{ fontSize: '0.75rem', color: '#aaa' }}>Stand 0.00 D</div>
              </div>
              <input
                type="number"
                min="0"
                value={einsatz === 0 ? '' : einsatz}
                placeholder="0"
                onChange={(e) => setEinsatz(Math.max(0, Number(e.target.value)))}
                style={{ width: '120px', padding: '0.4rem 0.6rem', fontSize: '1.8rem', fontWeight: 'bold', borderRadius: '8px', border: '1px solid #e5e7eb', textAlign: 'right', appearance: 'textfield', MozAppearance: 'textfield' } as any}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {[1, 5, 10, 100].map((v) => (
                <button
                  key={v}
                  onClick={() => setEinsatz((e) => e + v)}
                  style={{ flex: 1, padding: '0.4rem 0', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', color: '#333', fontWeight: '500' }}
                >
                  +{v}
                </button>
              ))}
              <button
                onClick={() => balance && setEinsatz(Math.floor(balance))}
                style={{ flex: 1, padding: '0.4rem 0', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', color: '#333', fontWeight: '500' }}
              >
                Max
              </button>
            </div>
          </div>

          {/* Um zu gewinnen */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f9fafb', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #e5e7eb' }}>
            <span style={{ fontSize: '0.9rem', color: '#666' }}>💰 Um zu gewinnen</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#16a34a' }}>+{gewinn.toFixed(2)}</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#16a34a' }}>D</span>
            </div>
          </div>

          {/* Kaufen Button */}
          {userId ? (
            <button
              onClick={bet}
              disabled={loading || einsatz <= 0}
              style={{ width: '100%', padding: '0.85rem', background: einsatz <= 0 ? '#ccc' : side === 'yes' ? '#16a34a' : '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: einsatz <= 0 ? 'not-allowed' : 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
            >
              {loading ? '...' : result || `${side === 'yes' ? 'Ja' : 'Nein'} kaufen`}
            </button>
          ) : (
            <button
              onClick={() => router.push(`/${tokenParam}`)}
              style={{ width: '100%', padding: '0.85rem', background: '#0f3460', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
            >
              Anmelden um zu traden
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
