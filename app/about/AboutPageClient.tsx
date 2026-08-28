'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppShell } from '../components/AppShellContext'

export default function AboutPageClient() {
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
            Wenn 73 Cent auf &bdquo;Ja&ldquo; stehen, glaubt die Masse, dass etwas mit 73 % Wahrscheinlichkeit eintritt.
          </Callout>
          <p style={pStyle}>
            Ein Prognosemarkt ist im Kern eine einfache Frage mit Preisschild. Dieser Preis repräsentiert eine Wahrscheinlichkeit. Wer glaubt, dass ein Ereignis eintritt, kauft JA-Anteile. Wer glaubt, dass dieses Ereignis nicht eintritt, kauft NEIN-Anteile. So entsteht aus vielen Einzelmeinungen ein einziges, verdichtetes Signal.
          </p>

          <MarketExample />

          <p style={pStyle}>
            Das funktioniert, weil Prognosemärkte die Anreizstruktur von Kapitalmärkten mit der Flexibilität direkter Ereignisprognosen kombinieren. Wer richtig liegt, gewinnt. Wer falsch liegt, verliert. Das schafft einen Anreiz, den es bei keiner Sonntagsumfrage und keinem YouTube-Kommentar gibt: es lohnt sich, die Wahrheit zu sagen.
          </p>
          <p style={pStyle}>
            Prognosemärkte sind keine Erfindung des Internets. Organisierte politische Prognosemärkte existierten nachweislich seit dem 16. Jahrhundert. Dort wurde in Italien nicht nur auf die päpstliche Nachfolge gewettet. Die Preisbildung erfasste nicht nur den wahrscheinlichen Sieger, sondern auch die Dauer der Konklaven, was auf eine bemerkenswert differenzierte Marktmikrostruktur hinweist. Diese Märkte wurden bereits 1503 als &bdquo;alte Praxis&ldquo; bezeichnet (vgl. Rhode &amp; Strumpf, 2008, S. 2).
          </p>
        </Section>

        <Divider />

        {/* Wie Wissen funktioniert */}
        <Section label="Wie Wissen funktioniert">
          <Callout>
            Kein Experte kennt alles. Aber jeder kennt etwas.
          </Callout>
          <p style={pStyle}>
            Der österreichisch-britische Ökonom Friedrich Hayek hat 1945 in seinem berühmten Aufsatz &bdquo;The Use of Knowledge in Society&ldquo; gezeigt, dass Wissen in einer Gesellschaft niemals zentral verfügbar ist. Es existiert nur lokal, implizit und über Millionen Menschen verteilt (vgl. Hayek, 1945, S. 519).
          </p>
          <SideNote title="Das Fahrrad-Beispiel">
            Das gilt besonders für implizites Wissen: Das ist Wissen, dass ein Mensch zwar hat, aber nicht formulieren kann. Wir alle wissen, wie man beim Fahrradfahren die Balance hält, aber wir können niemandem erklären, wie er beim Fahrradfahren die Balance halten kann, wenn er noch nie Fahrrad gefahren ist. Genauso spürt ein erfahrener Trader, wenn die Märkte nervös werden. Dieses Wissen erhalten Menschen nur über ihr Gespür, dass auf jahrelangen Erfahrungen basiert. Sie könnten dieses Wissen aber niemals in Datenbanken oder Notizbücher abtragen. Auf Prognosemärkten lässt es sich aber sehr gut in Preise übersetzen.
          </SideNote>
          <p style={pStyle}>
            Genau das leisten Prognosemärkte: Sie bündeln das implizite, lokal verteilte Wissen vieler Individuen zu einer einzigen intuitiven Zahl: der Eintrittswahrscheinlichkeit eines Ereignisses (vgl. Hayek, 1945, S. 526).
          </p>
        </Section>

        <Divider />

        {/* Was Prognosemärkte besonders macht */}
        <Section label="Was Prognosemärkte besonders macht">
          <Callout>
            Effizienter, schneller und genauer als alle Alternativen.
          </Callout>

          <FeatureBlock title="Echtzeit statt Momentaufnahme">
            Prognosemärkte reagieren sofort auf neue Informationen. Je näher ein Ereignis rückt, desto genauer werden die Preise und damit Eintrittswahrscheinlichkeiten. Normale Umfragen sind im Grunde nichts als Momentaufnahmen des Jetzt. Prognosemärkte dagegen sind lebendige Erwartungen über die Zukunft, die sich ständig anpassen.
          </FeatureBlock>

          <FeatureBlock title="Manipulationsresistent">
            Wer versucht, einen Preis künstlich zu verschieben, schafft damit eine Arbitrage-Gelegenheit für alle anderen. Manipulationen werden systematisch weg-arbitriert (vgl. Christiansen, 2007, S. 35f.).
          </FeatureBlock>

          <FeatureBlock title="Genauer als Experten">
            Prognosemärkte sind systematisch präziser als Experten. Einzelne Experten mögen zwar hochspezialisiert sein, besitzen aber trotzdem nur Wissensfragmente. Prognosemärkte preisen über die ihre Lebensdauer früher oder später das gesamte verfügbare Wissen aller Trader in die Eintrittswahrscheinlichkeit ihres Ereignisses ein (vgl. Snowberg, Wolfers &amp; Zitzewitz, 2012, S. 34f.).
          </FeatureBlock>

          <FeatureBlock title="Jeder findet seine Nische">
            Jeder kennt sich in einem bestimmten Gebiet oder einer bestimmten Nische besser aus als die meisten anderen Menschen. Prognosemärkte sprechen so auch Menschen an, die keine Verbindung zu klassischen Finanzmärkten haben. Jeder versteht Prognosemärkte und kann so gleich auf dem Gebiet seiner Leidenschaft oder seiner Inselbegabung traden.
          </FeatureBlock>
        </Section>

        <Divider />

        {/* Was die Forschung zeigt */}
        <Section label="Was die Forschung zeigt">
          <Callout>
            Wenige Teilnehmer reichen. Spielgeld auch.
          </Callout>
          <p style={pStyle}>
            Die häufigsten Einwände gegen Möbius lauten: zu wenig Teilnehmer, kein echtes Geld, zu sehr Nische als Mainstream. Die akademische Literatur widerlegt alle drei.
          </p>

          <FeatureBlock title="Ab 16 aktiven Teilnehmern">
            Ab 16 aktiven Teilnehmern verschwinden systematische Verzerrungen aus den Märkten, werden Manipulationen weg-arbitriert und Favoriten korrekt bewertet. Das gilt sogar für extreme Nischenmärkte ohne Medienberichterstattung oder Expertenkonsens, wie Jed D. Christiansen bereits 2007 nachgewiesen hat. Er hat die Vorhersagequalität von Prognosemärkten zu Ruder-Regatten geprüft, bei denen nur sehr wenige Trader teilgenommen haben, die dafür aber spezialisiertes Wissen hatten. Bereits ab 16 aktiven Tradern waren diese Prognosemärkte gut kalibriert (vgl. Christiansen, 2007, S. 28f.).
            <br /><br />
            Eine Studie unter Federführung von Forschenden der University of Bristol hat dies 2015 dann bestätigt, als sie wieder Prognosemärkte über künftige Ereignisse ohne große Medienberichterstattung oder allgemein anerkannte Experten testeten. Diesmal mussten Chemie-Doktoranden Prognosen über zukünftige Evaluationsergebnisse verschiedener Chemiefachbereiche im gesamten Vereinigten Königreich abgeben. Auch hier reichten wieder 16 Teilnehmende, um einen Markt sauber zu kalibrieren (vgl. Munafo et al., 2015, S. 6f.).
          </FeatureBlock>

          <FeatureBlock title="Extreme Genauigkeit">
            Spielgeld-Prognosemärkte sind real-money-äquivalent in ihrer Genauigkeit. Community, persönliches Interesse, Wettbewerb und der Wunsch, öffentlich recht zu behalten, schaffen ausreichend Anreize für ein gut kalibriertes System (vgl. Servan-Schreiber et al, 2004, S. 250).
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
            Gehandelt wird mit Dukaten (₫), dem virtuellen Spielgeld von Möbius. Kein Echtgeld. Keine Verluste. Aber die gleiche Prognosequalität (vgl. Servan-Schreiber et al, 2004, S. 250).
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

        <Divider />

        {/* Quellen */}
        <Section label="Quellen">
          <p style={{ ...pStyle, fontSize: 13 }}>
            Christiansen, J. (2012): Prediction Markets: Practical Experiments in small Markets and Behaviours observed. In <em>The Journal of Prediction Markets</em> 1 (1). DOI: 10.5750/jpm.v1i1.418.
          </p>
          <p style={{ ...pStyle, fontSize: 13 }}>
            Hayek, F. A. (1945): The Use of Knowledge in Society. In <em>American Economic Review</em>.
          </p>
          <p style={{ ...pStyle, fontSize: 13 }}>
            Manufo, M.; Pfeiffer, T.; Altmejd, A.; Heikensten, E.; Almenberg, J.; Bird, A. et al. (2015): Using prediction markets to forecast research evaluations. In <em>Royal Society Open Science</em> 2 (10), Article 150287.
          </p>
          <p style={{ ...pStyle, fontSize: 13 }}>
            Rhode, P.; Strumpf, K. (2008): Historical Political Futures Markets: An International Perspective. In <em>National Bureau of Economic Research</em> Article No. w14377. Available online at <a href="https://ssrn.com/abstract=1278451" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent, #6366f1)' }}>https://ssrn.com/abstract=1278451</a>.
          </p>
          <p style={{ ...pStyle, fontSize: 13, margin: 0 }}>
            Servan-Schreiber, E.; Wolfers, J.; Pennock, D.; Galebach, B. (2004): Prediction Markets: Does Money Matter? In <em>Electronic Markets</em> 14 (3). DOI: 10.1080/1019678042000245254.
          </p>
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

function MarketExample() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '24px 0 28px' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/about-market-beispiel.jpg"
        alt="Beispiel eines Möbius-Marktes: Wird es in New York heute wärmer als gestern? Aktuell 50 % Ja, 50 % Nein."
        style={{
          width: 280,
          maxWidth: '100%',
          borderRadius: 12,
          border: '1px solid var(--border, #e2e8f0)',
          boxShadow: '0 4px 16px rgba(15,23,42,0.06)',
        }}
      />
      <div style={{
        fontSize: 13, color: 'var(--text-muted, #64748b)', marginTop: 12,
        textAlign: 'center', maxWidth: 320, lineHeight: 1.5,
      }}>
        So sieht das auf Möbius konkret aus: 50&nbsp;% glauben an &bdquo;Ja&ldquo;, 50&nbsp;% an &bdquo;Nein&ldquo;. Der Preis für einen  &bdquo;Ja&ldquo;-Anteil liegt also bei 50ct. 
      </div>
    </div>
  )
}
