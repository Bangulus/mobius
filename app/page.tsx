'use client';

import { useState, useEffect } from 'react';
import BetButton from './components/BetButton';
import ProfileView from './components/ProfileView';
import AdminView from './components/AdminPanel';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ADMIN_ID = 'b75edaf4-141d-41f1-9555-887a8ddbac58';

export default function Page() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [markets, setMarkets] = useState<any[]>([]);
  const [trendingMarkets, setTrendingMarkets] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userId, setUserId] = useState('');
  const [token, setToken] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [view, setView] = useState<'markets' | 'portfolio' | 'leaderboard' | 'admin' | 'profile'>('markets');
  const [activeCategory, setActiveCategory] = useState('Trends');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('user_id');
    const tok = params.get('token');
    if (uid && tok) {
      setUserId(uid);
      setToken(tok);
      setLoggedIn(true);
      loadMarkets();
      loadUserData(uid);
      loadTrades(uid);
      loadLeaderboard();
      loadTrending();
    }
  }, []);

  async function loadMarkets() {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/markets?select=*`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    setMarkets(await response.json());
  }

  async function loadTrending() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const response = await fetch(
      `${supabaseUrl}/rest/v1/trades?created_at=gte.${since}&select=market_id`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const tradesData = await response.json();
    const counts: { [key: string]: number } = {};
    tradesData.forEach((t: any) => { counts[t.market_id] = (counts[t.market_id] || 0) + 1; });
    const sortedIds = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);

    if (sortedIds.length === 0) {
      const fallback = await fetch(
        `${supabaseUrl}/rest/v1/markets?status=eq.open&select=*&limit=10`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      setTrendingMarkets(await fallback.json());
      return;
    }
    const marketsResponse = await fetch(
      `${supabaseUrl}/rest/v1/markets?id=in.(${sortedIds.join(',')})&status=eq.open&select=*`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    setTrendingMarkets(await marketsResponse.json());
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
      setAvatarUrl(data[0].avatar_url || '');
    }
  }

  async function loadTrades(uid: string) {
    const tradesResponse = await fetch(
      `${supabaseUrl}/rest/v1/trades?user_id=eq.${uid}&select=*&order=created_at.desc`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const tradesData = await tradesResponse.json();
    const marketsResponse = await fetch(
      `${supabaseUrl}/rest/v1/markets?select=id,question,short_label`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const marketsData = await marketsResponse.json();
    const marketsMap: { [key: string]: any } = {};
    marketsData.forEach((m: any) => { marketsMap[m.id] = m; });
    setTrades(tradesData.map((trade: any) => ({ ...trade, market: marketsMap[trade.market_id] || null })));
  }

  async function loadLeaderboard() {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/users?select=username,balance,avatar_url&order=balance.desc&limit=10`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    setLeaderboard(await response.json());
  }

  async function signUp() {
    setLoading(true);
    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (data.user) {
      await fetch(`${supabaseUrl}/rest/v1/users`, {
        method: 'POST',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ id: data.user.id, email: data.user.email, username: username || email.split('@')[0] }),
      });
      setMessage('Konto erstellt. Du kannst dich jetzt anmelden.');
    } else {
      setMessage(data.msg || 'Fehler beim Registrieren.');
    }
    setLoading(false);
  }

  async function signIn() {
    setLoading(true);
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (data.access_token) {
      setTimeout(() => { window.location.href = `/?token=${data.access_token}&user_id=${data.user.id}`; }, 2000);
      setMessage('Login erfolgreich! Du wirst weitergeleitet...');
    } else {
      setMessage(data.error_description || 'Fehler beim Anmelden.');
    }
    setLoading(false);
  }

  function getLMSRProb(qYes: number, qNo: number, b: number) {
    const expYes = Math.exp(qYes / b);
    const expNo = Math.exp(qNo / b);
    return expYes / (expYes + expNo);
  }

  function groupMarkets(markets: any[]) {
    const groups: { [key: string]: { title: string; markets: any[]; isDisplay: boolean } } = {};
    markets.forEach((market) => {
      const key = market.group_title || market.display_group || `__single__${market.id}`;
      const isDisplay = !market.group_title && !!market.display_group;
      if (!groups[key]) groups[key] = { title: market.group_title || market.display_group || '', markets: [], isDisplay };
      groups[key].markets.push(market);
    });
    return groups;
  }

  function renderGroupDetail(groupKey: string, group: { title: string; markets: any[]; isDisplay: boolean }) {
    const rawProbs = group.markets.map((m) => getLMSRProb(m.q_yes, m.q_no, m.b));
    const total = rawProbs.reduce((a, b) => a + b, 0);
    const normProbs = rawProbs.map((p) => p / total);

    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const tokenParam = searchParams?.get('token') ? `?token=${searchParams.get('token')}&user_id=${searchParams.get('user_id')}` : '';

    return (
      <div key={groupKey} style={{ marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', background: 'white' }}>
        <div style={{ background: '#0f3460', color: 'white', padding: '0.6rem 1rem', fontWeight: 'bold', fontSize: '1rem' }}>
          {group.title}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '0.4rem 1rem', fontSize: '0.75rem', color: '#9ca3af', fontWeight: '600', borderBottom: '1px solid #f3f4f6' }}>
          <span>Option</span>
          <span>Wahrsch.</span>
        </div>

        {group.markets.map((market, i) => {
          const prob = normProbs[i];
          const probPct = Math.round(prob * 100);
          const yesPrice = Math.round(prob * 100);
          const noPrice = 100 - yesPrice;

          return (
            <div
              key={market.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                alignItems: 'center',
                padding: '0.6rem 1rem',
                borderBottom: '1px solid #f3f4f6',
                background: 'white',
              }}
            >
              <span
                onClick={() => window.location.href = `/markets/${market.id}${tokenParam}`}
                style={{ fontWeight: '500', fontSize: '0.9rem', color: '#111', cursor: 'pointer' }}
                title="Zur Marktdetailseite"
              >
                {market.short_label || market.question}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#111', minWidth: '2.5rem', textAlign: 'right' }}>
                  {probPct}%
                </span>
                <button
                  onClick={() => window.location.href = `/markets/${market.id}${tokenParam}`}
                  style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Ja {yesPrice}¢
                </button>
                <button
                  onClick={() => window.location.href = `/markets/${market.id}${tokenParam}`}
                  style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Nein {noPrice}¢
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderMarketGrid(marketList: any[]) {
    const grouped = groupMarkets(marketList);
    return Object.entries(grouped).map(([key, group]) => {
      if (group.markets.length > 1 && !group.isDisplay) {
        return renderGroupDetail(key, group);
      }

      return (
        <div key={key} style={{ marginBottom: '2rem' }}>
          {group.title && (
            <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.75rem', padding: '0.4rem 1rem', background: group.isDisplay ? '#64748b' : '#0f3460', color: 'white', borderRadius: '8px' }}>
              {group.title}
            </h2>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {group.markets.map((market: any) => (
              <div key={market.id} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '0.75rem', background: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#111' }}>
                  {market.short_label || market.question}
                </div>
                <BetButton
                  marketId={market.id}
                  currentQYes={market.q_yes}
                  currentQNo={market.q_no}
                  b={market.b}
                  userId={userId}
                  token={token}
                  onBalanceUpdate={(newBalance) => setBalance(newBalance)}
                />
              </div>
            ))}
          </div>
        </div>
      );
    });
  }

  if (loggedIn) {
    const openMarkets = markets.filter((m: any) => m.status === 'open');
    const categories = ['Trends', ...Array.from(new Set(openMarkets.map((m: any) => m.category).filter(Boolean))) as string[]];
    const filteredMarkets = activeCategory === 'Trends' ? trendingMarkets : openMarkets.filter((m: any) => m.category === activeCategory);

    return (
      <main style={{ padding: '2rem', fontFamily: 'sans-serif', background: '#f9fafb', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Möbius</h1>
          <div style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => setView('profile')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : <span>👤</span>}
              <span style={{ fontWeight: 'bold' }}>{displayName}</span>
            </div>
            <div style={{ color: '#16a34a', fontWeight: 'bold' }}>💰 {balance?.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dukaten</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => setView('markets')} style={{ padding: '0.5rem 1.5rem', background: view === 'markets' ? '#0f3460' : '#eee', color: view === 'markets' ? 'white' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}>Märkte</button>
          <button onClick={() => setView('portfolio')} style={{ padding: '0.5rem 1.5rem', background: view === 'portfolio' ? '#0f3460' : '#eee', color: view === 'portfolio' ? 'white' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}>Meine bisherigen Trades</button>
          <button onClick={() => { setView('leaderboard'); loadLeaderboard(); }} style={{ padding: '0.5rem 1.5rem', background: view === 'leaderboard' ? '#0f3460' : '#eee', color: view === 'leaderboard' ? 'white' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}>🏆 Leaderboard</button>
          {userId === ADMIN_ID && (
            <button onClick={() => setView('admin')} style={{ padding: '0.5rem 1.5rem', background: view === 'admin' ? '#7c3aed' : '#eee', color: view === 'admin' ? 'white' : '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}>⚙️ Admin</button>
          )}
        </div>

        {view === 'markets' && (
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              {categories.map((cat) => (
                <button key={cat} onClick={() => setActiveCategory(cat)} style={{ padding: '0.3rem 1rem', background: activeCategory === cat ? '#e11d48' : '#f3f4f6', color: activeCategory === cat ? 'white' : '#333', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: activeCategory === cat ? 'bold' : 'normal' }}>
                  {cat === 'Trends' ? '🔥 Trends' : cat}
                </button>
              ))}
            </div>
            {renderMarketGrid(filteredMarkets)}
          </div>
        )}

        {view === 'portfolio' && (
          <div>
            <h2>Meine Trades</h2>
            {trades.length === 0 && <p>Noch keine Trades platziert.</p>}
            {trades.map((trade: any) => (
              <div key={trade.id} style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '0.75rem', borderRadius: '8px', background: 'white' }}>
                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                  {trade.market?.short_label || trade.market?.question || 'Unbekannter Markt'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ background: trade.type === 'buy_yes' ? '#16a34a' : '#dc2626', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', marginRight: '0.5rem' }}>
                      {trade.type === 'buy_yes' ? 'YES' : 'NO'}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#666' }}>
                      {trade.shares} Anteile · Kosten: {Number(trade.cost).toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#999' }}>
                    {new Date(trade.created_at).toLocaleDateString('de-DE')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'leaderboard' && (
          <div>
            <h2>🏆 Leaderboard</h2>
            {leaderboard.map((user: any, index: number) => (
              <div key={user.username} style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '0.5rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: user.username === displayName ? '#f0f9ff' : 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: index === 0 ? '#f59e0b' : index === 1 ? '#9ca3af' : index === 2 ? '#b45309' : '#666' }}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </span>
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : <span>👤</span>}
                  <span style={{ fontWeight: user.username === displayName ? 'bold' : 'normal' }}>
                    {user.username} {user.username === displayName ? '(Du)' : ''}
                  </span>
                </div>
                <span style={{ color: '#16a34a', fontWeight: 'bold' }}>
                  💰 {Number(user.balance).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dukaten
                </span>
              </div>
            ))}
          </div>
        )}

        {view === 'profile' && (
          <ProfileView
            userId={userId}
            token={token}
            displayName={displayName}
            avatarUrl={avatarUrl}
            balance={balance}
            onUsernameChange={(name) => setDisplayName(name)}
            onAvatarChange={(url) => setAvatarUrl(url)}
          />
        )}

        {view === 'admin' && userId === ADMIN_ID && (
          <AdminView
            userId={userId}
            openMarkets={openMarkets}
            onMarketResolved={() => { loadMarkets(); loadUserData(userId); }}
          />
        )}
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '400px' }}>
      <h1>Möbius</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input type="email" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '0.5rem', fontSize: '1rem', borderRadius: '6px', border: '1px solid #ccc' }} />
        <input type="password" placeholder="Passwort" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '0.5rem', fontSize: '1rem', borderRadius: '6px', border: '1px solid #ccc' }} />
        <input type="text" placeholder="Benutzername (nur bei Registrierung)" value={username} onChange={(e) => setUsername(e.target.value)} style={{ padding: '0.5rem', fontSize: '1rem', borderRadius: '6px', border: '1px solid #ccc' }} />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={signIn} disabled={loading} style={{ flex: 1, padding: '0.5rem', background: '#0f3460', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}>Anmelden</button>
          <button type="button" onClick={signUp} disabled={loading} style={{ flex: 1, padding: '0.5rem', background: '#444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}>Registrieren</button>
        </div>
        {message && <p style={{ color: '#666' }}>{message}</p>}
      </div>
    </main>
  );
}
