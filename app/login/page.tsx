'use client';

import { useState, useEffect } from 'react';
import BetButton from './components/BetButton';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function Page() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [markets, setMarkets] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userId, setUserId] = useState('');
  const [token, setToken] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [view, setView] = useState<'markets' | 'portfolio' | 'leaderboard'>(
    'markets'
  );

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
    }
  }, []);

  async function loadMarkets() {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/markets?status=eq.open&select=*`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );
    const data = await response.json();
    setMarkets(data);
  }

  async function loadUserData(uid: string) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${uid}&select=*`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );
    const data = await response.json();
    if (data[0]) {
      setBalance(data[0].balance);
      setDisplayName(data[0].username);
    }
  }

  async function loadTrades(uid: string) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/trades?user_id=eq.${uid}&select=*&order=created_at.desc`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );
    const data = await response.json();
    setTrades(data);
  }

  async function loadLeaderboard() {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/users?select=username,balance&order=balance.desc&limit=10`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );
    const data = await response.json();
    setLeaderboard(data);
  }

  async function signUp() {
    setLoading(true);
    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (data.user) {
      await fetch(`${supabaseUrl}/rest/v1/users`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          id: data.user.id,
          email: data.user.email,
          username: username || email.split('@')[0],
        }),
      });
      setMessage('Konto erstellt. Du kannst dich jetzt anmelden.');
    } else {
      setMessage(data.msg || 'Fehler beim Registrieren.');
    }
    setLoading(false);
  }

  async function signIn() {
    setLoading(true);
    setMessage(`URL: ${supabaseUrl} | KEY: ${supabaseKey?.slice(0, 10)}`);
    const response = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      }
    );
    const data = await response.json();
    if (data.access_token) {
      const url = `/?token=${data.access_token}&user_id=${data.user.id}`;
      setTimeout(() => {
        window.location.href = url;
      }, 2000);
      setMessage('Login erfolgreich! Du wirst weitergeleitet...');
    } else {
      setMessage(data.error_description || 'Fehler beim Anmelden.');
    }
    setLoading(false);
  }

  function groupMarkets(markets: any[]) {
    const groups: { [key: string]: any[] } = {};
    markets.forEach((market) => {
      const key = market.group_title || '__ungrouped__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(market);
    });
    return groups;
  }

  if (loggedIn) {
    const groupedMarkets = groupMarkets(markets);

    return (
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <h1 style={{ margin: 0 }}>Prediction Markets</h1>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 'bold' }}>👤 {displayName}</div>
            <div style={{ color: '#16a34a', fontWeight: 'bold' }}>
              💰 {balance?.toFixed(2)} Punkte
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setView('markets')}
            style={{
              padding: '0.5rem 1.5rem',
              background: view === 'markets' ? '#0f3460' : '#eee',
              color: view === 'markets' ? 'white' : '#333',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Märkte
          </button>
          <button
            onClick={() => setView('portfolio')}
            style={{
              padding: '0.5rem 1.5rem',
              background: view === 'portfolio' ? '#0f3460' : '#eee',
              color: view === 'portfolio' ? 'white' : '#333',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Meine bisherigen Trades
          </button>
          <button
            onClick={() => {
              setView('leaderboard');
              loadLeaderboard();
            }}
            style={{
              padding: '0.5rem 1.5rem',
              background: view === 'leaderboard' ? '#0f3460' : '#eee',
              color: view === 'leaderboard' ? 'white' : '#333',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            🏆 Leaderboard
          </button>
        </div>

        {view === 'markets' && (
          <div>
            {Object.entries(groupedMarkets).map(
              ([groupTitle, groupMarkets]) => (
                <div key={groupTitle} style={{ marginBottom: '2rem' }}>
                  {groupTitle !== '__ungrouped__' && (
                    <h2
                      style={{
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        marginBottom: '0.75rem',
                        padding: '0.5rem 1rem',
                        background: '#0f3460',
                        color: 'white',
                        borderRadius: '8px',
                      }}
                    >
                      {groupTitle}
                    </h2>
                  )}
                  {groupMarkets.map((market: any) => (
                    <div
                      key={market.id}
                      style={{
                        border: '1px solid #ccc',
                        padding: '1rem 1.5rem',
                        marginBottom: '0.5rem',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontWeight: '500' }}>{market.question}</div>
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
              )
            )}
          </div>
        )}

        {view === 'portfolio' && (
          <div>
            <h2>Meine Trades</h2>
            {trades.length === 0 && <p>Noch keine Trades platziert.</p>}
            {trades.map((trade: any) => (
              <div
                key={trade.id}
                style={{
                  border: '1px solid #ccc',
                  padding: '1rem',
                  marginBottom: '0.75rem',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span
                    style={{
                      background:
                        trade.type === 'buy_yes' ? '#16a34a' : '#dc2626',
                      color: 'white',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      marginRight: '0.5rem',
                    }}
                  >
                    {trade.type === 'buy_yes' ? 'YES' : 'NO'}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#666' }}>
                    {trade.shares} Anteile · Kosten:{' '}
                    {Number(trade.cost).toFixed(2)}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#999' }}>
                  {new Date(trade.created_at).toLocaleDateString('de-DE')}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'leaderboard' && (
          <div>
            <h2>🏆 Leaderboard</h2>
            {leaderboard.map((user: any, index: number) => (
              <div
                key={user.username}
                style={{
                  border: '1px solid #ccc',
                  padding: '1rem',
                  marginBottom: '0.5rem',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background:
                    user.username === displayName ? '#f0f9ff' : 'white',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}
                >
                  <span
                    style={{
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color:
                        index === 0
                          ? '#f59e0b'
                          : index === 1
                          ? '#9ca3af'
                          : index === 2
                          ? '#b45309'
                          : '#666',
                    }}
                  >
                    {index === 0
                      ? '🥇'
                      : index === 1
                      ? '🥈'
                      : index === 2
                      ? '🥉'
                      : `#${index + 1}`}
                  </span>
                  <span
                    style={{
                      fontWeight:
                        user.username === displayName ? 'bold' : 'normal',
                    }}
                  >
                    {user.username}{' '}
                    {user.username === displayName ? '(Du)' : ''}
                  </span>
                </div>
                <span style={{ color: '#16a34a', fontWeight: 'bold' }}>
                  💰 {Number(user.balance).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    );
  }

  return (
    <main
      style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '400px' }}
    >
      <h1>Anmelden</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input
          type="email"
          placeholder="E-Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: '0.5rem',
            fontSize: '1rem',
            borderRadius: '6px',
            border: '1px solid #ccc',
          }}
        />
        <input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            padding: '0.5rem',
            fontSize: '1rem',
            borderRadius: '6px',
            border: '1px solid #ccc',
          }}
        />
        <input
          type="text"
          placeholder="Benutzername (nur bei Registrierung)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{
            padding: '0.5rem',
            fontSize: '1rem',
            borderRadius: '6px',
            border: '1px solid #ccc',
          }}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => alert('test')}
            style={{
              flex: 1,
              padding: '0.5rem',
              background: '#0f3460',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Anmelden
          </button>
          <button
            onClick={signUp}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.5rem',
              background: '#444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Registrieren
          </button>
        </div>
        {message && <p style={{ color: '#666' }}>{message}</p>}
      </div>
    </main>
  );
}
