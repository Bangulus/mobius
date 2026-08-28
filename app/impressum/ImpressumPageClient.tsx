'use client'

import { useRouter } from 'next/navigation'

export default function ImpressumPageClient() {
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
          Impressum
        </span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent, #6366f1)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Rechtliches
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--text, #0f172a)', letterSpacing: '-0.8px', margin: 0 }}>
            Impressum
          </h1>
        </div>

        {/* Angaben gemäß § 5 TMG */}
        <div style={{
          background: 'var(--card, #fff)',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: 12,
          padding: '24px 28px',
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
            Angaben gemäß § 5 TMG
          </div>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text, #0f172a)', lineHeight: 1.8 }}>
            Benno Möbius<br />
            Josef-May-Straße 1<br />
            60489 Frankfurt am Main<br />
            Deutschland
          </p>
        </div>

        {/* Kontakt */}
        <div style={{
          background: 'var(--card, #fff)',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: 12,
          padding: '24px 28px',
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
            Kontakt
          </div>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text, #0f172a)', lineHeight: 1.8 }}>
            E-Mail: benno@moebiusmarkets.de<br />
            Support: support@moebiusmarkets.de
          </p>
        </div>

        {/* Hinweis Spielgeld */}
        <div style={{
          background: 'var(--surface, #f1f5f9)',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: 12,
          padding: '24px 28px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
            Hinweis
          </div>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted, #475569)', lineHeight: 1.7 }}>
            Möbius ist eine Spielgeld-Plattform. Es werden keine Einsätze mit echtem Geld angenommen, keine Gewinne ausgezahlt und kein Glücksspiel im Sinne des Glücksspielstaatsvertrags angeboten. Die verwendete Währung „Dukaten" (₫) hat keinen Geldwert und ist nicht handelbar.
          </p>
        </div>

      </div>
    </div>
  )
}
