'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppShell } from '../components/AppShellContext'

interface Review {
  text: string
  username: string
}

const REVIEWS: Review[] = [
  {
    text: 'Die 3-Minuten-BTC-Märkte sind schon ziemlich dumm. Im positiven Sinne. Wollte eigentlich nur einmal ausprobieren und hab dann deutlich länger auf der Seite verbracht als geplant.',
    username: 'felix23',
  },
  {
    text: 'Ich kannte Prediction Markets vorher eigentlich nur von Polymarket. Finde den Ansatz von Möbius auf Deutsch echt gut. Vor allem weil man nicht direkt echtes Geld verliert.',
    username: 'chris_m',
  },
  {
    text: 'Was ich daran mag: Man merkt relativ schnell, dass „ich denke, ich wähle die Grünen“ und „ich denke, die Grünen gewinnen die Wahl“ zwei komplett verschiedene Aussagen sind. Und wenn man danebenliegt, sieht man es halt auch. Hat bei mir ein paar Illusionen zerstört lol.',
    username: 'whateverman',
  },
  {
    text: 'Bin über die Crypto-Märkte drauf gekommen. Die kurzen Märkte machen generell überraschend viel Spaß.',
    username: 'candleboy',
  },
  {
    text: 'Optisch finde ich Möbius schon ziemlich gelungen. Vor allem ist der Einstieg nicht so kompliziert. Man kann einfach ein paar Märkte anschauen und versteht relativ schnell, worum es geht.',
    username: 'maybe420bearish',
  },
  {
    text: 'Der interessante Teil ist eigentlich gar nicht das Gewinnen, sondern hinterher zu sehen, wie daneben die eigene Einschätzung war.',
    username: 'BerlinerJunge',
  },
  {
    text: 'Die Plattform ist noch relativ jung, merkt man auch. Wenn die Community weiterhin wächst und mehr interessante Märkte dazukommen, kann das gut werden.',
    username: 'BlueMango17',
  },
  {
    text: 'Man probiert hier auf Möbius halt auch Sachen aus, von denen man sonst wahrscheinlich die Finger davon lassen würde.',
    username: 'mrx56258',
  },
  {
    text: 'Hab eigentlich nur nach einem deutschsprachigen Prediction Market gesucht. Bin dann bei Möbius gelandet. Nicht alles ist für mich interessant, aber Wirtschaft und Geopolitik sind schon echt geil.',
    username: 'tomo007',
  },
  {
    text: 'Bei manchen Märkten hätte ich mir noch etwas mehr Auswahl gewünscht. Das Grundkonzept finde ich aber stark und gerade für Deutschland ist das Ganze ziemlich interessant.',
    username: 'kai69',
  },
  {
    text: 'Bin eher so der Typ, der normalerweise 15 Tabs gleichzeitig offen hat. Genau deshalb funktioniert Möbius bei mir irgendwie. Kurz reinschauen, ein paar Prognosen abgeben und später wiederkommen.',
    username: 'conditional01',
  },
  {
    text: 'Prediction Markets sind in Deutschland irgendwie noch viel zu wenig bekannt. Möbius macht das Konzept zumindest mal zugänglich, ohne dass man sich erstmal mit irgendwelchen komplizierten Finanzprodukten beschäftigen muss.',
    username: 'einfach92max',
  },
]

export default function BewertungenPage() {
  const router = useRouter()
  const { setPageAction } = useAppShell()

  useEffect(() => {
    setPageAction(
      <button className="nav-pill" onClick={() => router.push('/')} style={{ fontSize: 13 }}>← Zurück</button>
    )
    return () => setPageAction(null)
  }, [router, setPageAction])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f8fafc)' }}>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Reviews */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {REVIEWS.map((review, i) => (
            <div
              key={i}
              style={{
                background: 'var(--card, #fff)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: 10,
                padding: '18px 20px',
              }}
            >
              <p style={{
                margin: '0 0 12px',
                fontSize: 15,
                color: 'var(--text, #0f172a)',
                lineHeight: 1.7,
              }}>
                &bdquo;{review.text}&ldquo;
              </p>
              <div style={{
                fontSize: 13,
                color: 'var(--text-muted, #64748b)',
                fontWeight: 600,
              }}>
                — {review.username}
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div style={{
          marginTop: 48, padding: '24px', background: 'var(--surface, #f1f5f9)',
          border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text, #0f172a)', marginBottom: 6 }}>
            Selbst überzeugen?
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', marginBottom: 16 }}>
            Schau dir an, was auf Möbius gerade gehandelt wird.
          </div>
          <button
            onClick={() => router.push('/')}
            style={{
              padding: '10px 22px', background: 'var(--accent, #6366f1)', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Jetzt Prognosen entdecken →
          </button>
        </div>

      </div>
    </div>
  )
}
