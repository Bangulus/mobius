'use client'

import { useRouter } from 'next/navigation'

const RANK_EMBLEM_FILES: Record<string, string> = {
  Nadir:      '/nadir.png',
  Initiat:    '/initiat.png',
  Bayes:      '/bayes.png',
  Indigator:  '/indigator.png',
  Mantiker:   '/mantiker.png',
  Theoros:    '/theoros.png',
  Heliomant:  '/heliomant.png',
  Praesagium: '/praesagium.png',
  Möbius:     '/moebius.png',
}

const TITLE_RAMP: Record<string, { bg: string; color: string }> = {
  Nadir:      { bg: '#F1EFE8', color: '#444441' },
  Initiat:    { bg: '#FAECE7', color: '#712B13' },
  Bayes:      { bg: '#E6F1FB', color: '#0C447C' },
  Indigator:  { bg: '#E1F5EE', color: '#085041' },
  Mantiker:   { bg: '#EAF3DE', color: '#27500A' },
  Theoros:    { bg: '#FBEAF0', color: '#72243E' },
  Heliomant:  { bg: '#FAEEDA', color: '#633806' },
  Praesagium: { bg: '#FCEBEB', color: '#791F1F' },
  Möbius:     { bg: '#F3F4F6', color: '#111827' },
}

interface RankEntry {
  title: string
  description: string
}

const RANKS: RankEntry[] = [
  { title: 'Nadir',      description: 'Tiefster Punkt vor dem Aufstieg; das Gegenüber vom Zenit.' },
  { title: 'Initiat',    description: 'Gerade erst eingeweiht.' },
  { title: 'Bayes',      description: 'Aktualisiert Überzeugungen mit neuen Informationen.' },
  { title: 'Indigator',  description: 'Liest und verfolgt proaktiv Spuren.' },
  { title: 'Mantiker',   description: 'Die Mantik ist die Wissenschaft der Prophezeiung.' },
  { title: 'Theoros',    description: 'Offizieller staatlich beauftragter Gesandter zum Orakel.' },
  { title: 'Heliomant',  description: 'Sonnenwahrsager; liest Zukunft aus Sonnenphänomenen.' },
  { title: 'Praesagium', description: 'Das Vorzeichen selbst.' },
  { title: 'Möbius',     description: 'Höchster Titel; kann einmal erreicht, nie wieder verloren werden.' },
]

export default function RaengePage() {
  const router = useRouter()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f8fafc)' }}>

      {/* Nav */}
      <div style={{
        background: 'var(--primary, #1a1f3c)',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          ← Zurück
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginLeft: 16 }}>
          Ränge
        </span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Hero */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent, #6366f1)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Das Rang-System
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: 'var(--text, #0f172a)', lineHeight: 1.15, letterSpacing: '-1px', marginBottom: 16, margin: '0 0 16px' }}>
            Vom Nadir zum Möbius.
          </h1>
          <p style={{ fontSize: 17, color: 'var(--text-muted, #64748b)', lineHeight: 1.7, margin: 0 }}>
            Neun Ränge, die deinen Fortschritt als Prognostiker markieren. Jede Saison neu erspielt — bis auf einen.
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--border, #e2e8f0)' }}>
          {RANKS.map((rank) => {
            const colors = TITLE_RAMP[rank.title]
            return (
              <div
                key={rank.title}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  padding: '24px 4px',
                  borderBottom: '1px solid var(--border, #e2e8f0)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={RANK_EMBLEM_FILES[rank.title]}
                  alt={rank.title}
                  style={{ width: 64, height: 64, objectFit: 'contain', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'inline-block',
                    fontSize: 15,
                    fontWeight: 700,
                    padding: '3px 12px',
                    borderRadius: 8,
                    background: colors.bg,
                    color: colors.color,
                    marginBottom: 8,
                  }}>
                    {rank.title}
                  </span>
                  <p style={{ fontSize: 15, color: 'var(--text-muted, #475569)', lineHeight: 1.6, margin: 0 }}>
                    {rank.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: 40 }}>
          <button
            onClick={() => router.push('/')}
            style={{
              padding: '14px 28px', background: 'var(--accent, #6366f1)', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
              cursor: 'pointer', letterSpacing: '-0.2px',
            }}
          >
            Jetzt Prognosen entdecken →
          </button>
        </div>
      </div>
    </div>
  )
}
