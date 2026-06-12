'use client'

import { useRouter } from 'next/navigation'

export default function AboutPage() {
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
          Über Möbius
        </span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Hero */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent, #6366f1)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Was sind Prognosemärkte?
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: 'var(--text, #0f172a)', lineHeight: 1.15, letterSpacing: '-1px', marginBottom: 16, margin: '0 0 16px' }}>
            Eine einfache Frage.<br />Ein Preis. Eine Wahrscheinlichkeit.
          </h1>
          <p style={{ fontSize: 17, color: 'var(--text-muted, #64748b)', lineHeight: 1.7, margin: 0 }}>
            Prognosemärkte verwandeln kollektives Wissen in eine einzige Zahl. Sie sind präziser als Experten und Umfragen.
          </p>
        </div>

        <Divider />

        {/* Das Grundprinzip */}
        <Section label="Das Grundprinzip">
          <Callout>
            Wenn 73 Cent auf „Ja" stehen, glaubt die Masse, dass etwas mit 73 % Wahrscheinlichkeit eintritt.
          </Callout>
          <p style={pStyle}>
            Ein Prognosemarkt ist im Kern eine einfache Frage mit Preisschild. Dieser Preis repräsentiert eine Wahrscheinlichkeit. Wer glaubt, dass ein Ereignis eintritt, kauft JA-Anteile. Wer glaubt, dass dieses Ereignis nicht eintritt, kauft NEIN-Anteile. So entsteht aus vielen Einzelmeinungen ein einziges, verdichtetes Signal.
          </p>
          <p style={pStyle}>
            Das funktioniert, weil Prognosemärkte die Anreizstruktur von Kapitalmärkten mit der Flexibilität direkter Ereignisprognosen kombinieren. Wer richtig liegt, gewinnt. Wer falsch liegt, verliert. Das schafft einen Anreiz, den es bei keiner Sonntagsumfrage und keinem YouTube-Kommentar gibt: es lohnt sich, die Wahrheit zu sagen.
          </p>
          <p style={pStyle}>
            Prognosemärkte sind keine Erfindung des Internets. Organisierte politische Prognosemärkte existierten nachweislich seit dem 16. Jahrhundert. Dort wurde in Italien nicht nur auf die päpstliche Nachfolge gewettet. Die Preisbildung erfasste nicht nur den wahrscheinlichen Sieger, sondern auch die Dauer der Konklaven — was auf eine bemerkenswert differenzierte Marktmikrostruktur hinweist. Diese Märkte wurden bereits 1503 als „alte Praxis" bezeichnet.
          </p>
        </Section>

        <Divider />

        {/* Wie Wissen funktioniert */}
        <Section label="Wie Wissen funktioniert">
          <Callout>
            Kein Experte kennt alles. Aber jeder kennt etwas.
          </Callout>
          <p style={pStyle}>
            Der österreichisch-britische Ökonom Friedrich Hayek hat 1945 in seinem berühmten Aufsatz „The Use of Knowledge in Society" gezeigt, dass Wissen in einer Gesellschaft niemals zentral verfügbar ist. Es existiert nur lokal, implizit und über Millionen Menschen verteilt.
          </p>
          <SideNote title="Das Fahrrad-Beispiel">
            Das gilt besonders für implizites Wissen: Das ist Wissen, das ein Mensch zwar hat, aber nicht formulieren kann. Wir alle wissen, wie man beim Fahrradfahren die Balance hält — aber wir können niemandem erklären, wie er beim Fahrradfahren die Balance halten kann, wenn er noch nie Fahrrad gefahren ist. Genauso spürt ein erfahrener Trader, wenn die Märkte nervös werden. Auf Prognosemärkten lässt sich dieses Wissen in Preise übersetzen.
          </SideNote>
          <p style={pStyle}>
            Genau das leisten Prognosemärkte: Sie bündeln das implizite, lokal verteilte Wissen vieler Individuen zu einer einzigen intuitiven Zahl — der Eintrittswahrscheinlichkeit eines Ereignisses.
          </p>
        </Section>

        <Divider />

        {/* Was Prognosemärkte besonders macht */}
        <Section label="Was Prognosemärkte besonders macht">
          <Callout>
            Effizienter, schneller und genauer als alle Alternativen.
          </Callout>

          <FeatureBlock title="Echtzeit statt Momentaufnahme">
            Prognosemärkte reagieren sofort auf neue Informationen. Je näher ein Ereignis rückt, desto genauer werden die Preise. Normale Umfragen sind Momentaufnahmen des Jetzt. Prognosemärkte sind lebendige Erwartungen über die Zukunft, die sich ständig anpassen.
          </FeatureBlock>

          <FeatureBlock title="Manipulationsresistent">
            Wer versucht, einen Preis künstlich zu verschieben, schafft damit eine Arbitrage-Gelegenheit für alle anderen. Manipulationen werden systematisch weg-arbitriert.
          </FeatureBlock>

          <FeatureBlock title="Genauer als Experten">
            Prognosemärkte sind systematisch präziser als Experten. Einzelne Experten mögen hochspezialisiert sein, besitzen aber nur Wissensfragmente. Prognosemärkte preisen über ihre Lebensdauer das gesamte verfügbare Wissen aller Trader in die Eintrittswahrscheinlichkeit ein.
          </FeatureBlock>

          <FeatureBlock title="Jeder findet seine Nische">
            Jeder kennt sich in einem bestimmten Gebiet besser aus als die meisten anderen. Prognosemärkte sprechen auch Menschen an, die keine Verbindung zu klassischen Finanzmärkten haben. Jeder versteht sie — und kann auf dem Gebiet seiner Leidenschaft oder Inselbegabung traden.
          </FeatureBlock>
        </Section>

        <Divider />

        {/* Was die Forschung zeigt */}
        <Section label="Was die Forschung zeigt">
          <Callout>
            Wenige Teilnehmer reichen. Spielgeld auch.
          </Callout>
          <p style={pStyle}>
            Die häufigsten Einwände gegen Möbius lauten: zu wenig Teilnehmer, kein echtes Geld, zu sehr Nische. Die akademische Literatur widerlegt alle drei.
          </p>

          <FeatureBlock title="Ab 16 aktiven Teilnehmern">
            Ab 16 aktiven Teilnehmern verschwinden systematische Verzerrungen aus den Märkten, werden Manipulationen weg-arbitriert und Favoriten korrekt bewertet. Das gilt sogar für extreme Nischenmärkte ohne Medienberichterstattung — wie Jed D. Christiansen 2007 an Prognosen zu Ruder-Regatten gezeigt hat. Eine Studie der University of Bristol bestätigte dies 2015 mit Chemie-Doktoranden, die Evaluationsergebnisse verschiedener Fachbereiche prognostizierten.
          </FeatureBlock>

          <FeatureBlock title="Spielgeld ist äquivalent">
            Spielgeld-Prognosemärkte sind real-money-äquivalent in ihrer Genauigkeit. Community, persönliches Interesse, Wettbewerb und der Wunsch, öffentlich recht zu behalten, schaffen ausreichend Anreize für ein gut kalibriertes System.
          </FeatureBlock>
        </Section>

        <Divider />

        {/* Möbius */}
        <Section label="Möbius">
          <Callout>
            Die deutschsprachige Plattform für kollektive Vorhersagen.
          </Callout>
          <p style={pStyle}>
            Möbius macht Prognosemärkte für jeden zugänglich. Es ist eine Plattform für alle relevanten Themen: Wirtschaft. Sport. Krypto. Technologie. Geopolitik. Wetter. Kultur.
          </p>
          <p style={pStyle}>
            Gehandelt wird mit Dukaten (₫), dem virtuellen Spielgeld von Möbius. Kein Echtgeld. Keine Verluste. Aber die gleiche Prognosequalität.
          </p>
          <p style={pStyle}>
            Märkte lösen automatisch auf. Ergebnisse sind objektiv überprüfbar. Wer über viele Märkte hinweg gut lag, hat die Zukunft einfach besser gelesen als andere. Das ist selten. Das ist Möbius.
          </p>
          <p style={{ ...pStyle, fontWeight: 700, color: 'var(--text, #0f172a)', fontSize: 16 }}>
            Deine Meinung wird auf Möbius zum Beweis.
          </p>

          <div style={{ marginTop: 32 }}>
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
        </Section>

      </div>
    </div>
  )
}

// ── Hilfkomponenten ──────────────────────────────────────────

const pStyle: React.CSSProperties = {
  fontSize: 15,
  color: 'var(--text-muted, #475569)',
  lineHeight: 1.75,
  margin: '0 0 16px',
}

function Divider() {
  return <div style={{ borderTop: '1px solid var(--border, #e2e8f0)', margin: '48px 0' }} />
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--accent, #6366f1)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 18, fontWeight: 700, color: 'var(--text, #0f172a)',
      lineHeight: 1.4, marginBottom: 20,
      paddingLeft: 16, borderLeft: '3px solid var(--accent, #6366f1)',
    }}>
      {children}
    </div>
  )
}

function SideNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface, #f1f5f9)',
      border: '1px solid var(--border, #e2e8f0)',
      borderRadius: 10, padding: '16px 20px', margin: '20px 0',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </div>
      <p style={{ ...pStyle, margin: 0, fontSize: 14 }}>{children}</p>
    </div>
  )
}

function FeatureBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #0f172a)', marginBottom: 6 }}>
        {title}
      </div>
      <p style={{ ...pStyle, margin: 0 }}>{children}</p>
    </div>
  )
}
