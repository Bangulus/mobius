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

const CATEGORIES = ['Politik', 'Sport', 'Krypto', 'Entertainment', 'Wirtschaft', 'Geopolitik', 'Finanzen', 'Tech', 'Wetter', 'Kultur', 'formula1', 'finance', 'weather'];

interface Props {
  userId: string;
  openMarkets: any[];
  onMarketResolved: () => void;
}

async function fetchCount(path: string): Promise<number> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: 'HEAD',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Prefer: 'count=exact',
    },
  });
  const range = res.headers.get('content-range');
  if (!range) return 0;
  const total = range.split('/')[1];
  return total ? parseInt(total) : 0;
}

export default function AdminView({ userId, openMarkets, onMarketResolved }: Props) {
  const [adminTab, setAdminTab] = useState<'dashboard' | 'open' | 'resolved' | 'btc' | 'create' | 'edit' | 'users' | 'cronlogs'>('dashboard');
  const [adminCategory, setAdminCategory] = useState('');
  const [resolvingMarket, setResolvingMarket] = useState<string | null>(null);
  const [resolvedMarketDetails, setResolvedMarketDetails] = useState<any[]>([]);
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);
  const [btcCreating, setBtcCreating] = useState(false);
  const [btcMessage, setBtcMessage] = useState('');
  const [btcMarkets, setBtcMarkets] = useState<any[]>([]);
  const [resolvingBtc, setResolvingBtc] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const [allMarkets, setAllMarkets] = useState<any[]>([]);
  const [editingMarket, setEditingMarket] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{
    question: string; short_label: string; description: string;
    category: string; closes_at: string; group_title: string;
  }>({ question: '', short_label: '', description: '', category: '', closes_at: '', group_title: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editMessage, setEditMessage] = useState('');
  const [editSearch, setEditSearch] = useState('');
  const [editFilter, setEditFilter] = useState<'all' | 'manual' | 'auto'>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [newQuestion, setNewQuestion]       = useState('');
  const [newShortLabel, setNewShortLabel]   = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory]       = useState('Politik');
  const [newClosesAt, setNewClosesAt]       = useState('');
  const [newB, setNewB]                     = useState(100);
  const [newGroupTitle, setNewGroupTitle]   = useState('');
  const [createLoading, setCreateLoading]   = useState(false);
  const [createMessage, setCreateMessage]   = useState('');

  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');

  const [dashStats, setDashStats] = useState<{
    totalUsers: number;
    openMarkets: number;
    tradesToday: number;
    volumeToday: number;
    activeUsersToday: number;
    activeUsersWeek: number;
    topMarkets: any[];
  } | null>(null);
  const [dashLoading, setDashLoading] = useState(false);

  const [cronLogs, setCronLogs] = useState<any[]>([]);
  const [cronLogsLoading, setCronLogsLoading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (adminTab === 'btc')      loadBtcMarkets();
    if (adminTab === 'edit')     loadAllMarkets();
    if (adminTab === 'users')    loadUsers();
    if (adminTab === 'dashboard') loadDashboard();
    if (adminTab === 'cronlogs') loadCronLogs();
  }, [adminTab]);

  // ── Loaders ──────────────────────────────────────────────────────────────

  async function loadBtcMarkets() {
    const res = await fetch(`${supabaseUrl}/rest/v1/markets?is_auto=eq.true&select=*&order=created_at.desc`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    setBtcMarkets(await res.json());
  }

  async function loadAllMarkets() {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/markets?select=id,question,short_label,category,description,closes_at,group_title,is_auto,resolved&order=created_at.desc`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    setAllMarkets(await res.json());
  }

  async function loadUsers() {
    setUsersLoading(true);
    const res = await fetch(
      `${supabaseUrl}/rest/v1/users?select=id,username,balance,avatar_url,created_at&order=balance.desc`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    setUsers(await res.json());
    setUsersLoading(false);
  }

  async function loadDashboard() {
    setDashLoading(true);
    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
    const weekStart = new Date(); weekStart.setUTCDate(weekStart.getUTCDate() - 7); weekStart.setUTCHours(0, 0, 0, 0);
    const sinceToday = todayStart.toISOString();
    const sinceWeek = weekStart.toISOString();

    const [totalUsers, openMarketsCount, tradesTodayRes, tradesWeekRes, allOpenMarketsRes] = await Promise.all([
      fetchCount('users'),
      fetchCount('markets?status=eq.open&resolved=eq.false'),
      fetch(`${supabaseUrl}/rest/v1/trades?created_at=gte.${sinceToday}&select=user_id,cost,type`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      }),
      fetch(`${supabaseUrl}/rest/v1/trades?created_at=gte.${sinceWeek}&select=user_id,type`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      }),
      fetch(`${supabaseUrl}/rest/v1/markets?status=eq.open&select=id,question,short_label,q_yes,q_no`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      }),
    ]);

    const [tradesToday, tradesWeek, allOpenMarkets] = await Promise.all([
      tradesTodayRes.json(),
      tradesWeekRes.json(),
      allOpenMarketsRes.json(),
    ]);

    const buyTradesToday = (tradesToday ?? []).filter((t: any) => t.type === 'buy_yes' || t.type === 'buy_no');
    const buyTradesWeek  = (tradesWeek  ?? []).filter((t: any) => t.type === 'buy_yes' || t.type === 'buy_no');

    const volumeToday      = buyTradesToday.reduce((s: number, t: any) => s + Math.abs(t.cost ?? 0), 0);
    const activeUsersToday = new Set(buyTradesToday.map((t: any) => t.user_id)).size;
    const activeUsersWeek  = new Set(buyTradesWeek.map((t: any) => t.user_id)).size;

    const topMarkets = [...(allOpenMarkets ?? [])]
      .sort((a: any, b: any) => (b.q_yes + b.q_no) - (a.q_yes + a.q_no))
      .slice(0, 5);

    setDashStats({
      totalUsers,
      openMarkets: openMarketsCount,
      tradesToday: buyTradesToday.length,
      volumeToday: Math.round(volumeToday),
      activeUsersToday,
      activeUsersWeek,
      topMarkets,
    });
    setDashLoading(false);
  }

  async function loadCronLogs() {
    setCronLogsLoading(true);
    const res = await fetch(
      `${supabaseUrl}/rest/v1/cron_logs?select=*&order=ran_at.desc&limit=20`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    setCronLogs(await res.json());
    setCronLogsLoading(false);
  }

  // ── Editor ────────────────────────────────────────────────────────────────

  function openEditor(m: any) {
    setEditingMarket(m.id);
    let closesAtLocal = '';
    if (m.closes_at) {
      const d = new Date(m.closes_at);
      const pad = (n: number) => String(n).padStart(2, '0');
      closesAtLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    setEditFields({
      question:    m.question    ?? '',
      short_label: m.short_label ?? '',
      description: m.description ?? '',
      category:    m.category    ?? 'Politik',
      closes_at:   closesAtLocal,
      group_title: m.group_title ?? '',
    });
    setEditMessage('');
    setDeleteConfirm(null);
  }

  async function saveMarket(marketId: string) {
    setEditSaving(true); setEditMessage('');
    const body: any = {
      question:    editFields.question.trim(),
      short_label: editFields.short_label.trim() || editFields.question.trim().slice(0, 60),
      description: editFields.description.trim() || null,
      category:    editFields.category,
      group_title: editFields.group_title.trim() || null,
    };
    if (editFields.closes_at) body.closes_at = new Date(editFields.closes_at).toISOString();
    const res = await fetch(`${supabaseUrl}/rest/v1/markets?id=eq.${marketId}`, {
      method: 'PATCH',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setEditMessage('Gespeichert ✓');
      setAllMarkets(prev => prev.map(m => m.id === marketId ? { ...m, ...body } : m));
      setTimeout(() => { setEditMessage(''); setEditingMarket(null); }, 1500);
      onMarketResolved();
    } else {
      setEditMessage(`Fehler: ${await res.text()}`);
    }
    setEditSaving(false);
  }

  async function deleteMarket(marketId: string) {
    setDeleteLoading(true);
    await fetch(`${supabaseUrl}/rest/v1/trades?market_id=eq.${marketId}`, {
      method: 'DELETE',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    await fetch(`${supabaseUrl}/rest/v1/positions?market_id=eq.${marketId}`, {
      method: 'DELETE',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    const res = await fetch(`${supabaseUrl}/rest/v1/markets?id=eq.${marketId}`, {
      method: 'DELETE',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    if (res.ok) {
      setAllMarkets(prev => prev.filter(m => m.id !== marketId));
      setEditingMarket(null); setDeleteConfirm(null);
      onMarketResolved();
    }
    setDeleteLoading(false);
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async function saveUserBalance(userId: string) {
    const parsed = parseInt(newBalance);
    if (isNaN(parsed) || parsed < 0) { setUserMessage('Ungültiger Betrag.'); return; }
    const res = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ balance: parsed }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: parsed } : u));
      setUserMessage('Gespeichert ✓');
      setTimeout(() => { setUserMessage(''); setEditingUser(null); }, 1500);
    } else {
      setUserMessage('Fehler beim Speichern.');
    }
  }

  async function deleteUser(uid: string) {
    await fetch(`${supabaseUrl}/rest/v1/trades?user_id=eq.${uid}`, { method: 'DELETE', headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
    await fetch(`${supabaseUrl}/rest/v1/positions?user_id=eq.${uid}`, { method: 'DELETE', headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
    await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${uid}`, { method: 'DELETE', headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
    setUsers(prev => prev.filter(u => u.id !== uid));
    setDeleteUserConfirm(null);
  }

  // ── Krypto ────────────────────────────────────────────────────────────────

  async function createCryptoMarket(coin: string) {
    setBtcCreating(true); setBtcMessage('');
    const res = await fetch('/api/create-crypto-market', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coin }) });
    const data = await res.json();
    if (data.success) {
      setBtcMessage(`✅ ${coin}-Markt erstellt! Startpreis: $${Number(data.startPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      loadBtcMarkets(); onMarketResolved();
    } else { setBtcMessage(`❌ Fehler: ${data.error}`); }
    setBtcCreating(false);
  }

  async function resolveCryptoMarket(marketId: string) {
    setResolvingBtc(marketId); setBtcMessage('');
    const res = await fetch('/api/resolve-crypto-market', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ market_id: marketId }) });
    const data = await res.json();
    if (data.success) {
      const dir = data.resolution === 'yes' ? '📈 GESTIEGEN' : '📉 GEFALLEN';
      setBtcMessage(`✅ Aufgelöst: $${Number(data.start_price).toLocaleString()} → $${Number(data.end_price).toLocaleString()} · ${dir}`);
      loadBtcMarkets(); onMarketResolved();
    } else { setBtcMessage(`❌ Fehler: ${data.error ?? data.message}`); }
    setResolvingBtc(null);
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async function handleCreateMarket() {
    if (!newQuestion.trim()) { setCreateMessage('❌ Frage ist Pflichtfeld.'); return; }
    if (!newClosesAt) { setCreateMessage('❌ Schlussdatum ist Pflichtfeld.'); return; }
    setCreateLoading(true); setCreateMessage('');
    const body: any = {
      question:    newQuestion.trim(),
      short_label: newShortLabel.trim() || newQuestion.trim().slice(0, 60),
      description: newDescription.trim() || null,
      category:    newCategory,
      status:      'open', b: newB, q_yes: 0, q_no: 0,
      closes_at:   new Date(newClosesAt).toISOString(),
      resolved:    false, is_auto: false,
    };
    if (newGroupTitle.trim()) body.group_title = newGroupTitle.trim();
    const res = await fetch(`${supabaseUrl}/rest/v1/markets`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setCreateMessage('✅ Markt erstellt!');
      setNewQuestion(''); setNewShortLabel(''); setNewDescription('');
      setNewCategory('Politik'); setNewClosesAt(''); setNewB(100); setNewGroupTitle('');
      onMarketResolved();
    } else { setCreateMessage(`❌ Fehler: ${await res.text()}`); }
    setCreateLoading(false);
  }

  // ── Resolve manual markets ────────────────────────────────────────────────

  async function resolveMarket(marketId: string, resolution: 'yes' | 'no') {
    setResolvingMarket(marketId);
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/resolve_market`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ market_id: marketId, resolution }),
    });
    if (response.ok) {
      await fetch(`${supabaseUrl}/rest/v1/markets?id=eq.${marketId}`, {
        method: 'PATCH',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ resolved_at: new Date().toISOString() }),
      });
      onMarketResolved();
    }
    setResolvingMarket(null);
  }

  async function loadResolvedMarketDetails() {
    const [closedRes, tradesRes, usersRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/markets?resolved=eq.true&select=*&order=created_at.desc`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }),
      fetch(`${supabaseUrl}/rest/v1/trades?select=*`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }),
      fetch(`${supabaseUrl}/rest/v1/users?select=id,username`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }),
    ]);
    const [closedMarkets, allTrades, allUsers] = await Promise.all([closedRes.json(), tradesRes.json(), usersRes.json()]);
    const usersMap: Record<string, string> = {};
    allUsers.forEach((u: any) => { usersMap[u.id] = u.username; });
    setResolvedMarketDetails(closedMarkets.map((market: any) => {
      const marketTrades = allTrades.filter((t: any) => t.market_id === market.id);
      const winningType = market.resolution === 'yes' ? 'buy_yes' : 'buy_no';
      return {
        ...market,
        tradeDetails: marketTrades.map((t: any) => ({
          username: usersMap[t.user_id] || 'Unbekannt',
          type: t.type, cost: t.cost,
          won: t.type === winningType,
          payout: t.type === winningType ? t.shares : 0,
        })),
      };
    }));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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

  const filteredEditMarkets = allMarkets.filter(m => {
    const matchSearch = editSearch === '' ||
      (m.question ?? '').toLowerCase().includes(editSearch.toLowerCase()) ||
      (m.short_label ?? '').toLowerCase().includes(editSearch.toLowerCase());
    const matchFilter = editFilter === 'all' || (editFilter === 'auto' ? m.is_auto : !m.is_auto);
    return matchSearch && matchFilter;
  });

  const filteredUsers = users.filter(u =>
    userSearch === '' || (u.username ?? '').toLowerCase().includes(userSearch.toLowerCase())
  );

  // ── Styles ────────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
    borderRadius: 8, fontSize: 14, color: 'var(--text)', background: 'var(--bg)',
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6,
    display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em',
  };
  const tabBtn = (active: boolean, accent = '#7c3aed') => ({
    padding: '8px 18px',
    background: active ? accent : 'var(--surface)',
    color: active ? 'white' : 'var(--text-muted)',
    border: `1px solid ${active ? accent : 'var(--border)'}`,
    borderRadius: 8, cursor: 'pointer' as const, fontSize: 13, fontWeight: 600,
  });

  const statCard = (label: string, value: string | number, color = 'var(--text)') => (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: '-0.5px' }}>{value}</div>
    </div>
  );

  return (
    <div>
      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button style={tabBtn(adminTab === 'dashboard', '#7c3aed')}    onClick={() => setAdminTab('dashboard')}>📊 Dashboard</button>
        <button style={tabBtn(adminTab === 'open')}                     onClick={() => setAdminTab('open')}>Offene Märkte</button>
        <button style={tabBtn(adminTab === 'resolved')}                 onClick={() => { setAdminTab('resolved'); loadResolvedMarketDetails(); }}>Aufgelöste Märkte</button>
        <button style={tabBtn(adminTab === 'btc', '#f59e0b')}           onClick={() => setAdminTab('btc')}>🪙 Krypto-Märkte</button>
        <button style={tabBtn(adminTab === 'create', '#16a34a')}        onClick={() => setAdminTab('create')}>＋ Markt erstellen</button>
        <button style={tabBtn(adminTab === 'edit', '#0ea5e9')}          onClick={() => setAdminTab('edit')}>✏️ Märkte bearbeiten</button>
        <button style={tabBtn(adminTab === 'users', '#f97316')}         onClick={() => setAdminTab('users')}>👥 Nutzer</button>
        <button style={tabBtn(adminTab === 'cronlogs', '#64748b')}      onClick={() => setAdminTab('cronlogs')}>🔍 Cron-Logs</button>
      </div>

      {/* ── DASHBOARD ── */}
      {adminTab === 'dashboard' && (
        <div>
          {dashLoading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Lädt…</div>
          ) : dashStats ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
                {statCard('Nutzer gesamt', dashStats.totalUsers)}
                {statCard('Offene Märkte', dashStats.openMarkets, '#16a34a')}
                {statCard('Trades heute', dashStats.tradesToday, '#6366f1')}
                {statCard('Volumen heute', `${dashStats.volumeToday.toLocaleString('de')} ₫`, '#f59e0b')}
                {statCard('Aktive Nutzer heute', dashStats.activeUsersToday, '#0ea5e9')}
                {statCard('Aktive Nutzer diese Woche', dashStats.activeUsersWeek, '#8b5cf6')}
              </div>
              {dashStats.topMarkets.length > 0 && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Top-Märkte nach Volumen</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {dashStats.topMarkets.map((m: any, i: number) => {
                      const vol = Math.round(m.q_yes + m.q_no);
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', width: 20, textAlign: 'center' }}>{i + 1}</span>
                          <span style={{ fontSize: 13, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.short_label ?? m.question}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', flexShrink: 0 }}>{vol.toLocaleString('de')} ₫</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{ marginTop: 20 }}>
                <button onClick={loadDashboard} style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                  ↺ Aktualisieren
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── CRON LOGS ── */}
      {adminTab === 'cronlogs' && (
        <div style={{ maxWidth: 860 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Letzte 20 Cron-Läufe</div>
            <button onClick={loadCronLogs} style={{ padding: '6px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>↺ Aktualisieren</button>
          </div>
          {cronLogsLoading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Lädt…</div>
          ) : cronLogs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Noch keine Logs. Cron einmal manuell triggern.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cronLogs.map((log: any) => {
                const r = log.results ?? {}
                const ranAt = new Date(log.ran_at)
                const cryptoOk  = !r.cryptoResolveError && Object.keys(r).filter(k => k.startsWith('cryptoCreate_') && k.endsWith('_error')).length === 0
                const financeOk = !r.financeCreateError && !r.financeResolveError
                const weatherOk = !r.weatherCreateError && !r.weatherResolveError
                const weatherCreated  = r.weatherCreate?.created?.length ?? 0
                const weatherResolved = r.weatherResolve?.resolved ?? 0
                const financeCreated  = r.financeCreate?.created?.length ?? 0
                const financeErrors   = r.financeCreate?.errors?.length ?? 0

                return (
                  <div key={log.id} style={{
                    border: `1px solid ${log.had_errors ? 'rgba(220,38,38,0.3)' : 'rgba(22,163,74,0.2)'}`,
                    borderLeft: `4px solid ${log.had_errors ? '#dc2626' : '#16a34a'}`,
                    borderRadius: 10, overflow: 'hidden', background: 'var(--card)',
                  }}>
                    <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16 }}>{log.had_errors ? '🔴' : '🟢'}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                            {ranAt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} · {ranAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {log.had_errors ? 'Mit Fehlern' : 'Erfolgreich'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: cryptoOk ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', color: cryptoOk ? '#16a34a' : '#dc2626' }}>
                          🪙 Krypto {cryptoOk ? '✓' : '✗'}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: financeOk ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', color: financeOk ? '#16a34a' : '#dc2626' }}>
                          📈 Finance {financeOk ? `✓ ${financeCreated} neu` : `✗ ${financeErrors} Fehler`}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: weatherOk ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', color: weatherOk ? '#16a34a' : '#dc2626' }}>
                          🌤 Wetter {weatherOk ? `✓ ${weatherCreated} neu · ${weatherResolved} aufgelöst` : '✗ Fehler'}
                        </span>
                      </div>
                    </div>
                    {log.had_errors && (
                      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', background: 'rgba(220,38,38,0.04)', fontSize: 12, color: '#dc2626', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {r.weatherCreateError  && <div>weatherCreate: {String(r.weatherCreateError)}</div>}
                        {r.weatherResolveError && <div>weatherResolve: {String(r.weatherResolveError)}</div>}
                        {r.financeCreateError  && <div>financeCreate: {String(r.financeCreateError)}</div>}
                        {r.financeResolveError && <div>financeResolve: {String(r.financeResolveError)}</div>}
                        {r.cryptoResolveError  && <div>cryptoResolve: {String(r.cryptoResolveError)}</div>}
                        {r.weatherCreate?.errors?.length > 0 && <div>Wetter-Fehler: {r.weatherCreate.errors.join(', ')}</div>}
                        {r.financeCreate?.errors?.length  > 0 && <div>Finance-Fehler: {r.financeCreate.errors.join(', ')}</div>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MÄRKTE BEARBEITEN ── */}
      {adminTab === 'edit' && (
        <div style={{ maxWidth: 720 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              style={{ ...inputStyle, width: 260, marginBottom: 0 }}
              placeholder="Markt suchen…"
              value={editSearch}
              onChange={e => setEditSearch(e.target.value)}
            />
            {(['all', 'manual', 'auto'] as const).map(f => (
              <button key={f} onClick={() => setEditFilter(f)} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${editFilter === f ? '#0ea5e9' : 'var(--border)'}`, background: editFilter === f ? '#0ea5e9' : 'var(--surface)', color: editFilter === f ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                {f === 'all' ? 'Alle' : f === 'manual' ? 'Manuell' : 'Automatisch'}
              </button>
            ))}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>{filteredEditMarkets.length} Märkte</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredEditMarkets.map(m => (
              <div key={m.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => editingMarket === m.id ? setEditingMarket(null) : openEditor(m)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: editingMarket === m.id ? 'rgba(14,165,233,0.08)' : 'var(--card)',
                    borderBottom: editingMarket === m.id ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.short_label ?? m.question}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span>{m.category}</span>
                      {m.group_title && <><span>·</span><span>{m.group_title}</span></>}
                      <span style={{ padding: '1px 6px', borderRadius: 4, background: m.is_auto ? 'rgba(99,102,241,0.12)' : 'rgba(100,116,139,0.12)', color: m.is_auto ? '#6366f1' : 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}>
                        {m.is_auto ? 'AUTO' : 'MANUELL'}
                      </span>
                      {m.resolved && <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(220,38,38,0.1)', color: '#dc2626', fontSize: 10, fontWeight: 700 }}>AUFGELÖST</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 12 }}>
                    {editingMarket === m.id ? '▲' : '▼'}
                  </span>
                </div>
                {editingMarket === m.id && (
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Frage *</label>
                      <input style={inputStyle} value={editFields.question} onChange={e => setEditFields(f => ({ ...f, question: e.target.value }))} maxLength={300} />
                    </div>
                    <div>
                      <label style={labelStyle}>Kurztitel</label>
                      <input style={inputStyle} value={editFields.short_label} onChange={e => setEditFields(f => ({ ...f, short_label: e.target.value }))} placeholder="Wird auf der Übersichtsseite angezeigt" maxLength={80} />
                    </div>
                    <div>
                      <label style={labelStyle}>Auflösungsregeln</label>
                      <textarea
                        style={{ ...inputStyle, minHeight: 100, resize: 'vertical', fontSize: 13, lineHeight: 1.6 }}
                        value={editFields.description}
                        onChange={e => setEditFields(f => ({ ...f, description: e.target.value }))}
                        placeholder="z.B. Löst mit JA auf, wenn…"
                        maxLength={2000}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Kategorie</label>
                        <select style={inputStyle} value={editFields.category} onChange={e => setEditFields(f => ({ ...f, category: e.target.value }))}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Gruppe</label>
                        <input style={inputStyle} value={editFields.group_title} onChange={e => setEditFields(f => ({ ...f, group_title: e.target.value }))} placeholder="z.B. WM 2026" maxLength={80} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Schließt am</label>
                      <input style={inputStyle} type="datetime-local" value={editFields.closes_at} onChange={e => setEditFields(f => ({ ...f, closes_at: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                      <button onClick={() => saveMarket(m.id)} disabled={editSaving || !editFields.question.trim()} style={{ padding: '9px 22px', background: editSaving ? 'var(--surface)' : '#0ea5e9', color: editSaving ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: 8, cursor: editSaving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: editSaving ? 0.7 : 1 }}>
                        {editSaving ? 'Speichert…' : 'Speichern'}
                      </button>
                      <button onClick={() => setEditingMarket(null)} style={{ padding: '9px 16px', background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                        Abbrechen
                      </button>
                      {deleteConfirm === m.id ? (
                        <>
                          <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>Sicher löschen?</span>
                          <button onClick={() => deleteMarket(m.id)} disabled={deleteLoading} style={{ padding: '9px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                            {deleteLoading ? 'Löscht…' : 'Ja, löschen'}
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} style={{ padding: '9px 12px', background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                            Abbrechen
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteConfirm(m.id)} style={{ padding: '9px 16px', background: 'rgba(220,38,38,0.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginLeft: 'auto' }}>
                          🗑 Löschen
                        </button>
                      )}
                      {editMessage && (
                        <span style={{ fontSize: 13, fontWeight: 600, color: editMessage.includes('Fehler') ? '#dc2626' : '#16a34a' }}>{editMessage}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filteredEditMarkets.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>Keine Märkte gefunden.</div>
            )}
          </div>
        </div>
      )}

      {/* ── NUTZER ── */}
      {adminTab === 'users' && (
        <div style={{ maxWidth: 680 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <input style={{ ...inputStyle, width: 260, marginBottom: 0 }} placeholder="Nutzer suchen…" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filteredUsers.length} Nutzer</span>
          </div>
          {usersLoading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Lädt…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredUsers.map(u => (
                <div key={u.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {(u.username ?? '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{u.username}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.id === userId ? '👑 Du (Admin)' : u.id.slice(0, 8) + '…'}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{(u.balance ?? 0).toLocaleString('de')} ₫</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => { setEditingUser(u.id); setNewBalance(String(u.balance ?? 0)); setUserMessage(''); }} style={{ padding: '6px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                        ✏️ Guthaben
                      </button>
                      {u.id !== userId && (
                        <button onClick={() => setDeleteUserConfirm(u.id)} style={{ padding: '6px 10px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                  {editingUser === u.id && (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'rgba(249,115,22,0.04)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input type="number" min={0} style={{ ...inputStyle, width: 140, marginBottom: 0, fontSize: 14 }} value={newBalance} onChange={e => setNewBalance(e.target.value)} placeholder="Neues Guthaben" />
                      <button onClick={() => saveUserBalance(u.id)} style={{ padding: '8px 16px', background: '#f97316', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Speichern</button>
                      <button onClick={() => setEditingUser(null)} style={{ padding: '8px 12px', background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Abbrechen</button>
                      {userMessage && <span style={{ fontSize: 13, fontWeight: 600, color: userMessage.includes('Fehler') || userMessage.includes('Ungültig') ? '#dc2626' : '#16a34a' }}>{userMessage}</span>}
                    </div>
                  )}
                  {deleteUserConfirm === u.id && (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'rgba(220,38,38,0.04)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>Nutzer {u.username} — alle Daten löschen?</span>
                      <button onClick={() => deleteUser(u.id)} style={{ padding: '7px 14px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Ja, löschen</button>
                      <button onClick={() => setDeleteUserConfirm(null)} style={{ padding: '7px 12px', background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Abbrechen</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MARKT ERSTELLEN ── */}
      {adminTab === 'create' && (
        <div style={{ maxWidth: 600 }}>
          <div className="card" style={{ padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>Neuen Markt erstellen</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Frage *</label>
                <input style={inputStyle} placeholder="z.B. Wird Bitcoin 2026 auf 200.000$ steigen?" value={newQuestion} onChange={e => setNewQuestion(e.target.value)} maxLength={300} />
              </div>
              <div>
                <label style={labelStyle}>Kurztitel (optional)</label>
                <input style={inputStyle} placeholder="z.B. BTC auf 200k?" value={newShortLabel} onChange={e => setNewShortLabel(e.target.value)} maxLength={80} />
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 4 }}>Wird auf der Marktübersicht angezeigt. Falls leer: Frage wird gekürzt.</div>
              </div>
              <div>
                <label style={labelStyle}>Auflösungsregeln (optional)</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="z.B. Löst mit JA auf, wenn…" value={newDescription} onChange={e => setNewDescription(e.target.value)} maxLength={2000} />
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
                  <input style={inputStyle} type="number" min={10} max={10000} value={newB} onChange={e => setNewB(Math.max(10, parseInt(e.target.value) || 100))} />
                  <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 4 }}>100 = Standard.</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Schließt am *</label>
                  <input style={inputStyle} type="datetime-local" value={newClosesAt} onChange={e => setNewClosesAt(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Gruppe (optional)</label>
                  <input style={inputStyle} placeholder="z.B. WM 2026" value={newGroupTitle} onChange={e => setNewGroupTitle(e.target.value)} maxLength={80} />
                </div>
              </div>
              {createMessage && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: createMessage.startsWith('✅') ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', color: createMessage.startsWith('✅') ? '#16a34a' : '#dc2626', fontSize: 13, fontWeight: 600 }}>
                  {createMessage}
                </div>
              )}
              <button onClick={handleCreateMarket} disabled={createLoading} style={{ padding: '12px', background: createLoading ? 'var(--surface)' : '#16a34a', color: createLoading ? 'var(--text-muted)' : 'white', border: 'none', borderRadius: 10, cursor: createLoading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700 }}>
                {createLoading ? 'Wird erstellt…' : 'Markt erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── KRYPTO-MÄRKTE ── */}
      {adminTab === 'btc' && (
        <div>
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Neuen 3-Minuten Krypto-Markt starten</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COINS.map((c) => (
                <button key={c.id} onClick={() => createCryptoMarket(c.id)} disabled={btcCreating} style={{ padding: '8px 16px', background: c.color, color: 'white', border: 'none', borderRadius: 8, cursor: btcCreating ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, opacity: btcCreating ? 0.6 : 1 }}>
                  {btcCreating ? '⏳' : c.label}
                </button>
              ))}
            </div>
            {btcMessage && <div style={{ marginTop: 10, fontSize: 13, color: btcMessage.startsWith('✅') ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{btcMessage}</div>}
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
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: coinData?.color ?? '#888', color: 'white', fontSize: 11, fontWeight: 700 }}>{market.coin ?? 'BTC'}</span>
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
                  <button onClick={() => resolveCryptoMarket(market.id)} disabled={resolvingBtc === market.id} style={{ padding: '4px 12px', background: expired ? '#dc2626' : 'var(--surface)', color: expired ? 'white' : 'var(--text-muted)', border: `1px solid ${expired ? '#dc2626' : 'var(--border)'}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    {resolvingBtc === market.id ? '⏳ Wird aufgelöst…' : expired ? '⚡ Jetzt auflösen' : '🔧 Manuell auflösen'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── OFFENE MÄRKTE ── */}
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
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, padding: '4px 10px', background: '#7c3aed', color: 'white', borderRadius: 6, display: 'inline-block' }}>{groupTitle}</div>
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

      {/* ── AUFGELÖSTE MÄRKTE ── */}
      {adminTab === 'resolved' && (
        <div>
          {resolvedMarketDetails.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Noch keine aufgelösten Märkte.</div>}
          {resolvedMarketDetails.map((market: any) => (
            <div key={market.id} style={{ border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
              <div onClick={() => setExpandedMarket(expandedMarket === market.id ? null : market.id)} style={{ padding: '10px 14px', background: market.resolution === 'yes' ? '#16a34a' : '#dc2626', color: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                        {t.won ? <div style={{ color: '#16a34a', fontWeight: 700 }}>+{Number(t.payout).toFixed(0)} ₫ 🎉</div> : <div style={{ color: '#dc2626' }}>Verloren</div>}
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
