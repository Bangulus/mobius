'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PnLChart from './PnLChart';
import { xpForLevel, cumulativeXpForLevel } from '@/lib/progression';
import { BADGES } from '@/lib/badges';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function dbGet(table: string, params: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    cache: 'no-store',
  });
  return res.json();
}

async function dbPatch(table: string, params: string, body: object) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
}

function parseUTC(raw: string): Date {
  if (!raw) return new Date(0)
  if (raw.endsWith('Z') || raw.match(/[+-]\d{2}:\d{2}$/)) return new Date(raw)
  if (raw.match(/[+-]\d{2}$/)) return new Date(raw + ':00')
  return new Date(raw.replace(' ', 'T') + 'Z')
}

// ─── Icon System (Tabler outline SVGs, inline — kein npm-Paket) ───────────────

const ICON_PATHS: Record<string, string[]> = {
  trophy: ['M8 21l8 0', 'M12 17l0 4', 'M7 4l10 0', 'M17 4v8a5 5 0 0 1 -10 0v-8', 'M3 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M17 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0'],
  flame:  ['M12 10.941c2.333 -3.308 .167 -7.823 -1 -8.941c0 3.395 -2.235 5.299 -3.667 6.706c-1.43 1.408 -2.333 3.294 -2.333 5.588c0 3.704 3.134 6.706 7 6.706c3.866 0 7 -3.002 7 -6.706c0 -1.712 -1.232 -4.403 -2.333 -5.588c-2.084 3.353 -3.257 3.353 -4.667 2.235'],
}

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const paths = ICON_PATHS[name]
  if (!paths) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

interface Props {
  userId: string;
  token: string;
  displayName: string;
  avatarUrl: string;
  balance: number | null;
  xp?: number | null;
  level?: number | null;
  rp?: number | null;
  title?: string | null;
  peakTitle?: string | null;
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

interface PrivacySettings {
  guthaben: boolean;
  gewinn_verlust: boolean;
  groesster_gewinn: boolean;
  eingesetzt_gewonnen: boolean;
  streak: boolean;
  offene_positionen: boolean;
  aktivitaet: boolean;
  lieblingskategorie: boolean;
  durchschnittlicher_einsatz: boolean;
}

const DEFAULT_PRIVACY: PrivacySettings = {
  guthaben: true,
  gewinn_verlust: true,
  groesster_gewinn: true,
  eingesetzt_gewonnen: true,
  streak: true,
  offene_positionen: true,
  aktivitaet: true,
  lieblingskategorie: true,
  durchschnittlicher_einsatz: true,
};

const PRIVACY_LABELS: { key: keyof PrivacySettings; label: string; desc: string }[] = [
  { key: 'guthaben',                   label: 'Guthaben',           desc: 'Dein aktuelles Guthaben in ₫' },
  { key: 'gewinn_verlust',             label: 'Gewinn / Verlust',   desc: 'Gesamte Bilanz aller Prognosen' },
  { key: 'groesster_gewinn',           label: 'Größter Gewinn',     desc: 'Deine beste Einzelauszahlung' },
  { key: 'eingesetzt_gewonnen',        label: 'Eingesetzt & Gewonnen', desc: 'Gesamtvolumen deiner Trades' },
  { key: 'offene_positionen',          label: 'Offene Positionen',  desc: 'Anzahl aktiver Wetten' },
  { key: 'lieblingskategorie',         label: 'Lieblingskategorie', desc: 'In welcher Kategorie du am meisten handelst' },
  { key: 'durchschnittlicher_einsatz', label: 'Ø Einsatz',         desc: 'Durchschnittlicher Einsatz pro Prognose' },
  { key: 'aktivitaet',                 label: 'Aktivitäts-Feed',    desc: 'Deine letzten Trades öffentlich sichtbar' },
];

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

const CURRENT_TITLE_BG    = 'rgba(247,147,26,0.12)';
const CURRENT_TITLE_COLOR = '#c9740f';

const TITLE_RAMP: Record<string, { bg: string; color: string }> = {
  Nadir:      { bg: '#F1EFE8', color: '#444441' },
  Initiat:    { bg: '#FAECE7', color: '#712B13' },
  Bayes:      { bg: '#E6F1FB', color: '#0C447C' },
  Indigator:  { bg: '#E1F5EE', color: '#085041' },
  Mantiker:   { bg: '#EAF3DE', color: '#27500A' },
  Theoros:    { bg: '#FBEAF0', color: '#72243E' },
  Heliomant:  { bg: '#FAEEDA', color: '#633806' },
  Praesagium: { bg: '#FCEBEB', color: '#791F1F' },
};
function titleRampColors(title: string | null | undefined) {
  return TITLE_RAMP[title ?? ''] ?? TITLE_RAMP.Nadir;
}

function calcStreak(trades: TradeRow[]): number {
  if (trades.length === 0) return 0;
  const days = new Set(trades.map(t => {
    const d = parseUTC(t.created_at);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  }));
  let streak = 0;
  const now   = new Date();
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
  const d = parseUTC(iso);
  return {
    date: d.toLocaleDateString('de-DE',  { day: '2-digit', month: '2-digit', year: '2-digit' }),
    time: d.toLocaleTimeString('de-DE',  { hour: '2-digit', minute: '2-digit' }),
  };
}

type TabType    = 'positionen' | 'aktivitaet';
type SubTabType = 'offen' | 'geschlossen';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: checked ? 'var(--accent)' : 'var(--border-md)',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s', padding: 0,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, left: checked ? 23 : 3,
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

// ── PRIVACY-SEKTION ───────────────────────────────────────────

function PrivacySection({ userId }: { userId: string }) {
  const [open, setOpen]         = useState(false);
  const [privacy, setPrivacy]   = useState<PrivacySettings>(DEFAULT_PRIVACY);
  const [saving, setSaving]     = useState(false);
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    dbGet('users', `id=eq.${userId}&select=privacy_settings`).then(data => {
      if (data?.[0]?.privacy_settings) setPrivacy({ ...DEFAULT_PRIVACY, ...data[0].privacy_settings });
      setLoaded(true);
    });
  }, [open, loaded, userId]);

  const toggle = async (key: keyof PrivacySettings) => {
    const updated = { ...privacy, [key]: !privacy[key] };
    setPrivacy(updated);
    setSaving(true);
    await dbPatch('users', `id=eq.${userId}`, { privacy_settings: updated });
    setSaving(false);
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Datenschutz</span>
          {saving && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Speichert…</span>}
        </div>
        <span style={{ fontSize: 18, color: 'var(--text-muted)', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>▾</span>
      </div>

      {open && (
        <div style={{ borderTop: '0.5px solid var(--border)' }}>
          <div style={{ padding: '12px 18px', fontSize: 12, color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>
            Steuere was andere Nutzer auf deinem öffentlichen Profil sehen können.
          </div>
          {PRIVACY_LABELS.map((item, i) => (
            <div
              key={item.key}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 18px',
                borderBottom: i < PRIVACY_LABELS.length - 1 ? '0.5px solid var(--border)' : 'none',
              }}
            >
              <div style={{ flex: 1, minWidth: 0, marginRight: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: privacy[item.key] ? '#16a34a' : 'var(--text-muted)', fontWeight: 500 }}>
                  {privacy[item.key] ? 'Sichtbar' : 'Versteckt'}
                </span>
                <Toggle checked={privacy[item.key]} onChange={() => toggle(item.key)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── BADGE-SEKTION ─────────────────────────────────────────────

const BADGE_CATEGORY_LABELS: Record<string, string> = {
  trades: 'Trades',
  wins:   'Korrekte Prognosen',
  streak: 'Login-Streak',
};

function BadgeSection({ userId }: { userId: string }) {
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [awardedAt, setAwardedAt] = useState<Record<string, string>>({});
  const [loading, setLoading]     = useState(true);
  const [open, setOpen]           = useState(true);

  useEffect(() => {
    dbGet('user_badges', `user_id=eq.${userId}&select=badge_id,awarded_at`).then(rows => {
      const ids   = new Set<string>();
      const dates: Record<string, string> = {};
      (rows ?? []).forEach((r: { badge_id: string; awarded_at: string }) => {
        ids.add(r.badge_id);
        dates[r.badge_id] = r.awarded_at;
      });
      setEarnedIds(ids);
      setAwardedAt(dates);
      setLoading(false);
    });
  }, [userId]);

  const categories  = ['trades', 'wins', 'streak'] as const;
  const earnedCount = earnedIds.size;
  const totalCount  = BADGES.length;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Badges</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{earnedCount} / {totalCount} verdient</span>
          <span style={{ fontSize: 18, color: 'var(--text-muted)', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>▾</span>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: '0.5px solid var(--border)', padding: '20px 18px' }}>
          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Lädt…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {categories.map(cat => {
                const catBadges = BADGES.filter(b => b.category === cat);
                return (
                  <div key={cat}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                      {BADGE_CATEGORY_LABELS[cat]}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {catBadges.map(badge => {
                        const earned = earnedIds.has(badge.id);
                        const date   = awardedAt[badge.id];
                        return (
                          <div
                            key={badge.id}
                            title={earned && date ? `Verdient am ${parseUTC(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : 'Noch nicht verdient'}
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                              padding: '12px 14px', borderRadius: 12, minWidth: 80,
                              border:     earned ? '1px solid rgba(99,102,241,0.25)' : '1px solid var(--border)',
                              background: earned ? 'rgba(99,102,241,0.06)' : 'var(--surface)',
                              opacity: earned ? 1 : 0.4,
                              transition: 'all 0.15s',
                            }}
                          >
                            <span style={{ fontSize: 28, filter: earned ? 'none' : 'grayscale(1)' }}>{badge.icon}</span>
                            <span style={{ fontSize: 11, fontWeight: earned ? 600 : 400, color: earned ? 'var(--text)' : 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>
                              {badge.label}
                            </span>
                            {earned && date && (
                              <span style={{ fontSize: 10, color: 'var(--text-subtle)', textAlign: 'center' }}>
                                {parseUTC(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── PROGRESSIONS-SEKTION ──────────────────────────────────────

interface SeasonHistoryEntry {
  seasonId:   string;
  startDate:  string;
  rp:         number;
  peakTitle:  string;
}

function monthLabel(isoDate: string): string {
  return parseUTC(isoDate).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
}

function ProgressionSection({ userId, xp, level, rp, title, peakTitle }: {
  userId: string; xp: number; level: number; rp: number; title: string; peakTitle: string;
}) {
  const [historyOpen, setHistoryOpen]       = useState(false);
  const [history, setHistory]               = useState<SeasonHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded]   = useState(false);

  const xpFloor   = level > 1 ? cumulativeXpForLevel(level - 1) : 0;
  const xpForThis = xpForLevel(level);
  const xpInto    = Math.max(0, Math.min(xpForThis, xp - xpFloor));

  const loadHistory = useCallback(async () => {
    if (historyLoaded) return;
    setHistoryLoading(true);
    const seasonRows: { season_id: string; rp: number; peak_title: string }[] =
      await dbGet('user_seasons', `user_id=eq.${userId}&select=season_id,rp,peak_title`);
    if (!seasonRows || seasonRows.length === 0) { setHistory([]); setHistoryLoading(false); setHistoryLoaded(true); return; }
    const seasonIds = seasonRows.map(r => r.season_id);
    const seasons: { id: string; start_date: string }[] =
      await dbGet('seasons', `id=in.(${seasonIds.join(',')})&select=id,start_date`);
    const seasonMap: Record<string, string> = {};
    seasons?.forEach(s => { seasonMap[s.id] = s.start_date; });
    setHistory(
      seasonRows
        .filter(r => seasonMap[r.season_id])
        .map(r => ({ seasonId: r.season_id, startDate: seasonMap[r.season_id], rp: r.rp, peakTitle: r.peak_title }))
        .sort((a, b) => parseUTC(b.startDate).getTime() - parseUTC(a.startDate).getTime())
    );
    setHistoryLoading(false);
    setHistoryLoaded(true);
  }, [userId, historyLoaded]);

  const toggleHistory = () => { const next = !historyOpen; setHistoryOpen(next); if (next) loadHistory(); };

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>Level {level}</span>
            <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 8, background: CURRENT_TITLE_BG, color: CURRENT_TITLE_COLOR, fontWeight: 500 }}>{title}</span>
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{xpInto.toLocaleString('de')} / {xpForThis.toLocaleString('de')} XP bis Level {level + 1}</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--surface)', overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ width: `${Math.round((xpInto / xpForThis) * 100)}%`, height: '100%', background: '#7F77DD', borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '0.5px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{rp.toLocaleString('de')} RP <span style={{ color: 'var(--text-subtle)' }}>diese Saison</span></span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Bestwert dieser Saison: <span style={{ color: 'var(--text)', fontWeight: 500 }}>{peakTitle}</span></span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div onClick={toggleHistory} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>Titel-Historie</span>
          <span style={{ fontSize: 18, color: 'var(--text-muted)', transition: 'transform 0.2s', transform: historyOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>▾</span>
        </div>
        {historyOpen && (
          <div style={{ borderTop: '0.5px solid var(--border)' }}>
            {historyLoading ? (
              <div style={{ padding: '20px 18px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Wird geladen…</div>
            ) : history.length === 0 ? (
              <div style={{ padding: '20px 18px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Noch keine abgeschlossenen Saisons.</div>
            ) : history.map((h, i) => {
              const colors = titleRampColors(h.peakTitle);
              return (
                <div key={h.seasonId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 18px', borderBottom: i < history.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{monthLabel(h.startDate)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{h.rp.toLocaleString('de')} RP</span>
                    <span style={{ fontSize: 12, padding: '2px 9px', borderRadius: 8, background: colors.bg, color: colors.color, fontWeight: 500 }}>{h.peakTitle}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProfileView({ userId, displayName, avatarUrl, balance, xp, level, rp, title, peakTitle, onUsernameChange, onAvatarChange }: Props) {
  const router = useRouter();
  const [newUsername, setNewUsername]         = useState(displayName);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingUsername, setSavingUsername]   = useState(false);
  const [profileMessage, setProfileMessage]   = useState('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [tab, setTab]                         = useState<TabType>('positionen');
  const [subTab, setSubTab]                   = useState<SubTabType>('offen');
  const [allRows, setAllRows]                 = useState<PortfolioEntry[]>([]);
  const [allTrades, setAllTrades]             = useState<TradeRow[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const isMobile                              = useIsMobile();

  const gewonnen        = allRows.filter(r => r.market.resolved && r.auszahlung !== null && r.auszahlung > 0);
  const groessterGewinn = gewonnen.length > 0 ? Math.max(...gewonnen.map(r => r.auszahlung ?? 0)) : 0;
  const offeneRows      = allRows.filter(r => !r.market.resolved);
  const geschlosseneRows = allRows.filter(r => r.market.resolved);
  const displayRows     = subTab === 'offen' ? offeneRows : geschlosseneRows;
  const streak          = calcStreak(allTrades);
  const trefferquote    = calcTrefferquote(allRows);
  const totalEinsatz    = allRows.reduce((s, r) => s + r.einsatz, 0);

  useEffect(() => {
    if (!userId) return;
    dbPatch('users', `id=eq.${userId}`, { last_seen_at: new Date().toISOString() });
  }, [userId]);

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
    markets?.forEach(m => { marketMap[m.id] = m; });

    const entryMap: Record<string, PortfolioEntry> = {};
    for (const trade of trades) {
      const market = marketMap[trade.market_id];
      if (!market) continue;
      const isBuy  = trade.type === 'buy_yes' || trade.type === 'buy_no';
      const isSell = trade.type === 'sell_yes' || trade.type === 'sell_no';
      const dir: 'yes' | 'no' = trade.type.includes('yes') ? 'yes' : 'no';
      if (!entryMap[trade.market_id]) {
        const closedAt = (market as any).resolved_at ?? market.closes_at ?? null;
        entryMap[trade.market_id] = { market, einsatz: 0, direction: dir, auszahlung: null, tradeCreatedAt: trade.created_at, marketClosedAt: closedAt };
      }
      const entry = entryMap[trade.market_id];
      if (isBuy)  { entry.einsatz += Math.abs(trade.cost); entry.direction = dir; }
      if (isSell) { entry.auszahlung = (entry.auszahlung ?? 0) + Math.abs(trade.cost); }
    }
    for (const entry of Object.values(entryMap)) {
      const m = entry.market;
      if (!m.resolved || entry.auszahlung !== null) continue;
      const won = (m.resolution === 'yes' && entry.direction === 'yes') || (m.resolution === 'no' && entry.direction === 'no');
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
    if (userId) {
      loadPortfolio();
      const id = setInterval(loadPortfolio, 3000);
      return () => clearInterval(id);
    }
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

  const headerCard = (
    <div className="card" style={{ padding: isMobile ? '20px 16px' : '28px 28px 24px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 14 : 20, marginBottom: 20 }}>
        <div style={{ flexShrink: 0 }}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Avatar" style={{ width: isMobile ? 64 : 80, height: isMobile ? 64 : 80, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: isMobile ? 64 : 80, height: isMobile ? 64 : 80, borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? 22 : 28, fontWeight: 700, border: '2px solid var(--border)' }}>
              {displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            {editingUsername ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%' }}>
                <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveUsername(); if (e.key === 'Escape') setEditingUsername(false); }}
                  style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, padding: '4px 10px', borderRadius: 8, border: '1.5px solid var(--accent)', background: 'var(--surface)', color: 'var(--text)', flex: 1, minWidth: 0 }} />
                <button onClick={saveUsername} disabled={savingUsername} style={{ padding: '4px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{savingUsername ? '…' : 'OK'}</button>
                <button onClick={() => setEditingUsername(false)} style={{ padding: '4px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>✕</button>
              </div>
            ) : (
              <>
                <span style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: 'var(--text)' }}>{displayName}</span>
                <button onClick={() => setEditingUsername(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px', fontSize: 14, lineHeight: 1 }}>✎</button>
              </>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>Guthaben: <strong style={{ color: 'var(--yes)' }}>{(balance ?? 0).toLocaleString('de')} ₫</strong></span>
            <span>·</span>
            <span>{allRows.length} Prognosen</span>
          </div>
          {profileMessage && (
            <div style={{ marginTop: 6, fontSize: 12, color: profileMessage.startsWith('Fehler') ? 'var(--no)' : 'var(--yes)' }}>{profileMessage}</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, alignItems: 'flex-end' }}>
          <label style={{ fontSize: 12, padding: '6px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer', color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {uploadingAvatar ? 'Lädt…' : 'Bild ändern'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) uploadAvatar(e.target.files[0]); }} />
          </label>
          <button onClick={() => router.push(`/profil/${encodeURIComponent(displayName)}`)} style={{ fontSize: 12, padding: '6px 14px', background: 'var(--accent-light)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20, cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Mein vollständiges Profil →
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderTop: '1px solid var(--border)', paddingTop: isMobile ? 16 : 20, gap: 8 }}>
        {[
          { label: 'Portfoliowert',  value: `${Math.round(balance ?? 0).toLocaleString('de')} ₫`, color: 'var(--text)' },
          { label: 'Größter Gewinn', value: groessterGewinn > 0 ? `+${Math.round(groessterGewinn).toLocaleString('de')} ₫` : '—', color: groessterGewinn > 0 ? 'var(--yes)' : 'var(--text-muted)' },
          { label: 'Prognosen',      value: String(allRows.length), color: 'var(--text)' },
        ].map((s, i) => (
          <div key={s.label} style={{ paddingLeft: i > 0 ? (isMobile ? 12 : 20) : 0, borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize: isMobile ? 10 : 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.3 }}>{s.label}</div>
            <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 700, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const rightCards = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PnLChart userId={userId} displayName={displayName} avatarUrl={avatarUrl} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Streak</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: streak >= 3 ? '#f59e0b' : 'var(--text)', letterSpacing: '-1px', lineHeight: 1 }}>{streak}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{streak === 1 ? 'Tag' : 'Tage'}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 4 }}>
            {streak === 0 ? 'Heute noch nicht aktiv' : streak >= 7 ? (<>Serie läuft <Icon name="flame" size={12} /></>) : streak >= 3 ? 'Konstant aktiv' : 'Starte heute'}
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
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                {trefferquote >= 60 ? 'Überdurchschnittlich' : trefferquote >= 40 ? 'Solide' : 'Noch Luft nach oben'}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {headerCard}{rightCards}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 24 }}>
          {headerCard}{rightCards}
        </div>
      )}

      <ProgressionSection
        userId={userId} xp={xp ?? 0} level={level ?? 1}
        rp={rp ?? 0} title={title ?? 'Nadir'} peakTitle={peakTitle ?? title ?? 'Nadir'}
      />

      <BadgeSection userId={userId} />

      <PrivacySection userId={userId} />

      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 20, display: 'flex', overflowX: 'auto' }}>
        {(['positionen', 'aktivitaet'] as TabType[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 20px', fontSize: 14, whiteSpace: 'nowrap',
            fontWeight: tab === t ? 700 : 500,
            color: tab === t ? 'var(--text)' : 'var(--text-muted)',
            borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.15s', fontFamily: 'var(--font)',
          }}>
            {t === 'positionen' ? 'Positionen' : 'Aktivität'}
          </button>
        ))}
      </div>

      {tab === 'positionen' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {(['offen', 'geschlossen'] as SubTabType[]).map(s => (
              <button key={s} onClick={() => setSubTab(s)} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: '1px solid var(--border)',
                background: subTab === s ? 'var(--text)' : 'var(--surface)',
                color: subTab === s ? 'var(--bg)' : 'var(--text-muted)',
                transition: 'all 0.15s', fontFamily: 'var(--font)',
              }}>
                {s === 'offen' ? `Offen (${offeneRows.length})` : `Geschlossen (${geschlosseneRows.length})`}
              </button>
            ))}
          </div>

          {portfolioLoading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 13 }}>Wird geladen…</div>
          ) : displayRows.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
              {subTab === 'offen' ? 'Keine offenen Positionen.' : 'Noch keine abgeschlossenen Positionen.'}
            </div>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {displayRows.map((entry) => {
                const m = entry.market;
                const isYes = entry.direction === 'yes';
                const resolved = m.resolved;
                const won  = resolved && entry.auszahlung !== null && entry.auszahlung > 0;
                const lost = resolved && entry.auszahlung === 0;
                const marktName = m.is_auto && m.coin ? `${m.coin} · 3-Min-Markt` : m.question;
                const richtungLabel = m.is_auto ? (isYes ? 'Up ↑' : 'Down ↓') : (isYes ? 'Ja' : 'Nein');
                const dateSource = subTab === 'geschlossen' && entry.marketClosedAt ? entry.marketClosedAt : entry.tradeCreatedAt;
                const { date } = formatDateTime(dateSource);
                return (
                  <div key={entry.market.id} className="card" style={{ padding: '13px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, flex: 1 }}>{marktName.length > 60 ? marktName.slice(0, 60) + '…' : marktName}</div>
                      <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 600, flexShrink: 0, background: isYes ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)', color: isYes ? '#15803d' : '#b91c1c' }}>{richtungLabel}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Einsatz: <strong style={{ color: 'var(--text)' }}>{Math.round(entry.einsatz).toLocaleString('de')} ₫</strong></span>
                      {!resolved ? <span style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(245,158,11,0.12)', color: '#b45309', fontWeight: 600, fontSize: 11 }}>Läuft</span>
                        : won ? <span style={{ color: 'var(--yes)', fontWeight: 700 }}>+{Math.round(entry.auszahlung ?? 0).toLocaleString('de')} ₫</span>
                        : lost ? <span style={{ color: 'var(--no)', fontWeight: 700 }}>–{Math.round(entry.einsatz).toLocaleString('de')} ₫</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 6 }}>{date}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface)' }}>
                    {['Markt', 'Tipp', 'Eingesetzt', 'Ergebnis', 'Auszahlung', subTab === 'offen' ? 'Gesetzt am' : 'Geschlossen am'].map((h, i) => (
                      <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '12px 20px', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((entry) => {
                    const m = entry.market;
                    const isYes = entry.direction === 'yes';
                    const richtungLabel = m.is_auto ? (isYes ? '↑ Up' : '↓ Down') : (isYes ? 'Ja' : 'Nein');
                    const marktName = m.is_auto && m.coin ? `${m.coin} · 3-Minuten-Markt` : m.question;
                    const iconEl = m.is_auto && m.coin ? (<span style={{ width: 28, height: 28, borderRadius: 8, background: COIN_COLORS[m.coin] ?? '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{m.coin.charAt(0)}</span>) : null;
                    const resolved = m.resolved;
                    const won  = resolved && entry.auszahlung !== null && entry.auszahlung > 0;
                    const lost = resolved && entry.auszahlung === 0;
                    const dateSource = subTab === 'geschlossen' && entry.marketClosedAt ? entry.marketClosedAt : entry.tradeCreatedAt;
                    const { date, time } = formatDateTime(dateSource);
                    const ergebnisLabel = resolved ? (m.is_auto ? (m.resolution === 'yes' ? 'UP ↑' : 'DOWN ↓') : (m.resolution === 'yes' ? 'Ja' : 'Nein')) : '';
                    return (
                      <tr key={entry.market.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text)', maxWidth: 280 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{iconEl}<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 240 }}>{marktName}</span></div>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}><span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: isYes ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)', color: isYes ? '#15803d' : '#b91c1c' }}>{richtungLabel}</span></td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{Math.round(entry.einsatz).toLocaleString('de')} ₫</td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          {!resolved ? <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'rgba(245,158,11,0.12)', color: '#b45309', fontWeight: 600 }}>Läuft</span>
                            : <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, fontWeight: 600, background: won ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)', color: won ? '#15803d' : '#b91c1c' }}>{ergebnisLabel}</span>}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontSize: 13, fontWeight: 700 }}>
                          {!resolved && entry.auszahlung === null ? <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12 }}>ausstehend</span>
                            : won  ? <span style={{ color: 'var(--yes)' }}>+{Math.round(entry.auszahlung ?? 0).toLocaleString('de')} ₫</span>
                            : lost ? <span style={{ color: 'var(--no)' }}>–{Math.round(entry.einsatz).toLocaleString('de')} ₫</span>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
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

      {tab === 'aktivitaet' && <AktivitaetsFeed userId={userId} />}
    </div>
  );
}

interface FeedMarket {
  question: string; is_auto: boolean; coin?: string;
  category?: string; resolved: boolean; resolution?: string;
}

interface FeedItem {
  id: string; market_id: string; type: string;
  shares: number; cost: number; created_at: string; market?: FeedMarket;
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
        const myBuys = withMarkets.filter(x => x.market_id === t.market_id && (x.type === 'buy_yes' || x.type === 'buy_no'));
        if (myBuys.length === 0) { processedWins.add(t.market_id); continue; }
        const direction = myBuys[0].type.includes('yes') ? 'yes' : 'no';
        const won = m.resolution === direction;
        processedWins.add(t.market_id);
        if (!won) continue;
        const totalShares = myBuys.reduce((s, x) => s + (x.shares ?? 0), 0);
        if (totalShares <= 0) continue;
        const firstBuyTime = parseUTC(myBuys[myBuys.length - 1].created_at).getTime();
        winItems.push({ id: `win_${t.market_id}`, market_id: t.market_id, type: 'win', shares: totalShares, cost: totalShares, created_at: new Date(firstBuyTime + 3 * 60 * 1000).toISOString(), market: m });
      }

      setItems([...withMarkets, ...winItems].sort((a, b) => parseUTC(b.created_at).getTime() - parseUTC(a.created_at).getTime()));
      setLoading(false);
    }
    load();
  }, [userId]);

  function formatTime(iso: string) {
    const d    = parseUTC(iso);
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

  if (loading) return <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 13 }}>Wird geladen…</div>;
  if (items.length === 0) return <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Noch keine Aktivität.</div>;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {items.map((item, idx) => {
        const m       = item.market;
        const isBuy   = item.type.startsWith('buy');
        const isSell  = item.type.startsWith('sell');
        const isWin   = item.type === 'win';
        const isYes   = item.type.includes('yes');
        const coinColor = !isWin && m?.is_auto && m.coin ? COIN_COLORS[m.coin] ?? '#f97316' : null;
        const marketLabel = m ? m.is_auto ? `${m.coin} · 3-Min-Markt` : (m.question.length > 52 ? m.question.slice(0, 52) + '…' : m.question) : 'Unbekannter Markt';
        const dirLabel = m?.is_auto ? (isYes ? 'Up ↑' : 'Down ↓') : (isYes ? 'Ja' : 'Nein');
        let iconBg = 'rgba(99,102,241,0.12)'; let iconContent: React.ReactNode = '⇄';
        if (isWin)      { iconBg = 'rgba(22,163,74,0.15)'; iconContent = <Icon name="trophy" size={17} />; }
        else if (isBuy) { iconBg = isYes ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)'; iconContent = isYes ? '↑' : '↓'; }
        let subText = ''; let amountLabel = ''; let amountColor = 'var(--text)';
        if (isWin)       { const resLabel = m?.is_auto ? (m.resolution === 'yes' ? 'Up ↑' : 'Down ↓') : (m?.resolution === 'yes' ? 'Ja' : 'Nein'); subText = `Gewonnen · ${resLabel}`; amountLabel = `+${Math.round(item.cost).toLocaleString('de')} ₫`; amountColor = 'var(--yes)'; }
        else if (isBuy)  { subText = `Einsatz auf ${dirLabel}`; amountLabel = `${Math.round(Math.abs(item.cost)).toLocaleString('de')} ₫`; amountColor = 'var(--text-muted)'; }
        else if (isSell) { subText = `Verkauft · ${dirLabel}`; amountLabel = `+${Math.round(Math.abs(item.cost)).toLocaleString('de')} ₫`; amountColor = 'var(--yes)'; }
        return (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
            {coinColor ? (
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: coinColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>{m?.coin?.charAt(0)}</div>
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{iconContent}</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: isWin ? 600 : 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{marketLabel}</div>
              {subText && <div style={{ fontSize: 12, color: isWin ? '#15803d' : 'var(--text-muted)', marginTop: 2, fontWeight: isWin ? 600 : 400 }}>{subText}</div>}
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
