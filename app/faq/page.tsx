'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface FAQItem {
  question: string
  answer: string
}

const FAQ_SECTIONS: { title: string; items: FAQItem[] }[] = [
  {
    title: 'Grundlagen',
    items: [
      {
        question: 'Was ist Möbius?',
        answer: 'Möbius ist eine deutschsprachige Plattform für Prognosemärkte. Nutzer handeln mit Spielgeld (Dukaten) auf Fragen zu Politik, Wirtschaft, Sport, Krypto, Wetter, Technologie, Kultur und vieles mehr.',
      },
      {
        question: 'Was ist ein Prognosemarkt?',
        answer: 'Ein Prognosemarkt ist im Kern eine handelbare Frage: Du kaufst einen Anteil auf Ja oder Nein, und der aktuelle Preis spiegelt wider, wie alle Trader die Chancen einschätzen. Tritt das Ereignis ein, gewinnen alle, die auf "Ja" gesetzt haben. Tritt es nicht ein, gewinnen die "Nein"-Käufer.',
      },
      {
        question: 'Wie funktioniert Möbius genau?',
        answer: 'Du wählst einen Markt, kaufst Anteile auf „Ja" oder „Nein" und wartest auf die Auflösung. Je mehr Menschen glauben, dass ein Ereignis eintritt, desto teurer wird der Ja-Anteil und desto höher wird die angezeigte Eintrittswahrscheinlichkeit.',
      },
      {
        question: 'Ist Möbius kostenlos?',
        answer: 'Ja. Registrierung und Nutzung sind vollständig kostenlos.',
      },
      {
        question: 'Ist Möbius anonym nutzbar?',
        answer: 'Ja. Du brauchst nur eine E-Mail-Adresse und einen Nutzernamen. Dein Klarname wird nirgendwo angezeigt.',
      },
    ],
  },
  {
    title: 'Dukaten & Spielgeld',
    items: [
      {
        question: 'Warum Spielgeld und kein Echtgeld?',
        answer: 'Weil die BaFin Vermarktung und Betrieb von binären Optionsmärkten an Privatkunden in Deutschland verboten hat. Binäre Optionen ähneln laut BaFin zu sehr dem Glücksspiel. Möbius nutzt daher seine eigene Spielwährung: Dukaten (₫). Das ist allerdings kein Kompromiss. Spielgeld-Prognosemärkte sind genauso präzise wie Echtgeldmärkte.',
      },
      {
        question: 'Was sind Dukaten?',
        answer: 'Dukaten (₫) sind die Spielwährung von Möbius. Sie haben keinen echten Geldwert, aber funktionieren auf der Plattform wie echtes Kapital. Du kannst sie einsetzen, gewinnen und verlieren.',
      },
      {
        question: 'Wie viele Dukaten bekomme ich beim Start?',
        answer: 'Jeder neue Account startet mit 1.000 ₫.',
      },
      {
        question: 'Kann ich Dukaten kaufen?',
        answer: 'Nein. Dukaten können nicht gekauft werden. Sie entstehen nur durch Gewinne auf der Plattform.',
      },
      {
        question: 'Kann ich Dukaten auszahlen lassen?',
        answer: 'Nein. Dukaten können nicht ausgezahlt werden.',
      },
      {
        question: 'Was passiert, wenn ich alle Dukaten verliere?',
        answer: 'Du bekommst ein Startguthaben gutgeschrieben, damit du weitermachen kannst.',
      },
      {
        question: 'Verfallen Dukaten irgendwann?',
        answer: 'Nein. Dukaten verfallen nicht.',
      },
    ],
  },
  {
    title: 'Handeln & Märkte',
    items: [
      {
        question: 'Wie kaufe ich Anteile an einem Markt?',
        answer: 'Öffne einen Möbius-Markt, wähle „Ja" oder „Nein", gib deinen Einsatz in Dukaten ein und bestätige den Kauf. Du siehst sofort, wie viele Anteile du erhalten hast und zu welchem Preis.',
      },
      {
        question: 'Kann ich meine Position vor Marktende verkaufen?',
        answer: 'Ja. Du kannst Anteile jederzeit vor der Auflösung verkaufen.',
      },
      {
        question: 'Was passiert, wenn ein Markt endet?',
        answer: 'Der Markt wird automatisch aufgelöst. Wer auf die richtige Seite gesetzt hat, bekommt seine Auszahlung direkt gutgeschrieben.',
      },
      {
        question: 'Wer entscheidet, wie ein Markt aufgelöst wird?',
        answer: 'Alle Märkte werden auf Grundlage klar nachvollziehbarer Auflösungsregeln aufgelöst. Du findest die jeweiligen Auflösungsregeln unter jedem Möbius-Markt.',
      },
      {
        question: 'Wie wird der Preis in einem Markt berechnet?',
        answer: 'Möbius nutzt einen Logarithmic Market Scoring Rule — einen mathematischen Market Maker. Er berechnet den Preis automatisch aus dem Verhältnis aller gekauften Ja- und Nein-Anteile. Kein Mensch setzt den Preis manuell.',
      },
      {
        question: 'Warum verändert sich der Preis wenn ich kaufe?',
        answer: 'Weil jeder Kauf das Verhältnis von Ja- zu Nein-Anteilen verschiebt. Je mehr Menschen auf Ja setzen, desto teurer wird Ja und desto günstiger wird Nein. Das ist der Mechanismus, der den Preis zur Wahrscheinlichkeit macht.',
      },
      {
        question: 'Was ist eine Limit-Order?',
        answer: 'Bei einer Limit-Order kaufst du nicht zum aktuellen Marktpreis, sondern zu deinem Wunschpreis. Diesen kannst du individuell festlegen. Dein Kaufauftrag wartet dann so lange, bis der Markt deinen Wunschpreis erreicht. Das gibt dir volle Kontrolle über deinen realisierten Preis — und funktioniert auch bei Verkäufen.',
      },
      {
        question: 'Wie lange laufen Märkte?',
        answer: 'Das ist je nach Markttyp unterschiedlich. Krypto-Märkte laufen drei Minuten. Wetter-Märkte sind tagesbasiert. Es gibt auch Märkte, die über Wochen oder Monate laufen.',
      },
      {
        question: 'Kann ich eigene Märkte erstellen?',
        answer: 'Diese Funktion ist in Entwicklung. Aktuell werden Märkte von der Möbius-Administration erstellt.',
      },
      {
        question: 'Was passiert mit meinen Anteilen wenn ein Markt gelöscht wird?',
        answer: 'Dein eingesetztes Guthaben wird dir vollständig zurückerstattet.',
      },
    ],
  },
  {
    title: 'Datenschutz & Technik',
    items: [
      {
        question: 'Wo werden meine Daten gespeichert?',
        answer: 'Möbius nutzt Supabase als Datenbankinfrastruktur. Die Daten werden auf europäischen Servern gespeichert.',
      },
    ],
  },
]

export default function FAQPage() {
  const router = useRouter()
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})

  const toggle = (key: string) => {
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }))
  }

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
          Häufige Fragen
        </span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent, #6366f1)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            FAQ
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--text, #0f172a)', letterSpacing: '-0.8px', margin: '0 0 12px' }}>
            Häufige Fragen
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-muted, #64748b)', margin: 0, lineHeight: 1.6 }}>
            Alles was du über Möbius und Prognosemärkte wissen musst.
          </p>
        </div>

        {/* Sections */}
        {FAQ_SECTIONS.map((section) => (
          <div key={section.title} style={{ marginBottom: 40 }}>

            {/* Section Title */}
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              marginBottom: 12, paddingBottom: 10,
              borderBottom: '1px solid var(--border, #e2e8f0)',
            }}>
              {section.title}
            </div>

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {section.items.map((item, i) => {
                const key = `${section.title}-${i}`
                const isOpen = !!openItems[key]
                return (
                  <div
                    key={key}
                    style={{
                      background: 'var(--card, #fff)',
                      border: '1px solid var(--border, #e2e8f0)',
                      borderRadius: 10,
                      overflow: 'hidden',
                      transition: 'border-color 0.15s',
                      borderColor: isOpen ? 'var(--accent, #6366f1)' : 'var(--border, #e2e8f0)',
                    }}
                  >
                    {/* Question */}
                    <button
                      onClick={() => toggle(key)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', gap: 16,
                        padding: '16px 20px', background: 'none', border: 'none',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <span style={{
                        fontSize: 14, fontWeight: 700,
                        color: isOpen ? 'var(--accent, #6366f1)' : 'var(--text, #0f172a)',
                        lineHeight: 1.4,
                      }}>
                        {item.question}
                      </span>
                      <span style={{
                        flexShrink: 0, fontSize: 16, color: 'var(--text-muted, #94a3b8)',
                        transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                        fontWeight: 400, lineHeight: 1,
                      }}>
                        +
                      </span>
                    </button>

                    {/* Answer */}
                    {isOpen && (
                      <div style={{
                        padding: '0 20px 18px',
                        borderTop: '1px solid var(--border, #f1f5f9)',
                      }}>
                        <p style={{
                          margin: '14px 0 0',
                          fontSize: 14, color: 'var(--text-muted, #475569)',
                          lineHeight: 1.7,
                        }}>
                          {item.answer}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Footer CTA */}
        <div style={{
          marginTop: 48, padding: '24px', background: 'var(--surface, #f1f5f9)',
          border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text, #0f172a)', marginBottom: 6 }}>
            Noch Fragen?
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', marginBottom: 16 }}>
            Schau dir an, wie Prognosemärkte funktionieren.
          </div>
          <button
            onClick={() => router.push('/about')}
            style={{
              padding: '10px 22px', background: 'var(--accent, #6366f1)', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Mehr über die Möbius-Prognosemärkte →
          </button>
        </div>

      </div>
    </div>
  )
}
