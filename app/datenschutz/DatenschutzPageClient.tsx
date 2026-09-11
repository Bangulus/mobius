'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppShell } from '../components/AppShellContext'

const CONSENT_KEY = 'mobius_cookie_consent'

export default function DatenschutzPageClient() {
  const router = useRouter()
  const { setPageAction } = useAppShell()

  useEffect(() => {
    setPageAction(
      <button className="nav-pill" onClick={() => router.push('/')} style={{ fontSize: 13 }}>← Zurück</button>
    )
    return () => setPageAction(null)
  }, [router, setPageAction])

  function resetCookieConsent() {
    localStorage.removeItem(CONSENT_KEY)
    window.location.reload()
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--card, #fff)',
    border: '1px solid var(--border, #e2e8f0)',
    borderRadius: 12,
    padding: '24px 28px',
    marginBottom: 24,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #94a3b8)',
    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14,
  }
  const textStyle: React.CSSProperties = {
    margin: 0, fontSize: 15, color: 'var(--text, #0f172a)', lineHeight: 1.8,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f8fafc)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent, #6366f1)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Rechtliches
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: 'var(--text, #0f172a)', letterSpacing: '-0.8px', margin: 0 }}>
            Datenschutzerklärung
          </h1>
        </div>

        {/* Verantwortlicher */}
        <div style={cardStyle}>
          <div style={labelStyle}>Verantwortlicher</div>
          <p style={textStyle}>
            Benno Möbius<br />
            Josef-May-Straße 1<br />
            60489 Frankfurt am Main<br />
            Deutschland<br /><br />
            E-Mail: benno@moebiusmarkets.de
          </p>
        </div>

        {/* Übersicht der Verarbeitung */}
        <div style={cardStyle}>
          <div style={labelStyle}>Welche Daten wir verarbeiten</div>
          <p style={{ ...textStyle, marginBottom: 12 }}>
            Bei der Registrierung: E-Mail-Adresse, Benutzername, Passwort (verschlüsselt gespeichert über unseren Auth-Anbieter).
          </p>
          <p style={{ ...textStyle, marginBottom: 12 }}>
            Bei der Nutzung: getätigte Trades, Positionen, Dukaten-Guthaben (Spielgeld, kein echtes Geld), Profil-Aktivität.
          </p>
          <p style={textStyle}>
            Technisch, bei jedem Seitenaufruf: IP-Adresse und Standard-Server-Logs unseres Hosting-Anbieters (Vercel).
          </p>
        </div>

        {/* Zwecke & Rechtsgrundlagen */}
        <div style={cardStyle}>
          <div style={labelStyle}>Zwecke und Rechtsgrundlagen</div>
          <p style={{ ...textStyle, marginBottom: 12 }}>
            Konto-Erstellung, Login und Abwicklung der Spielgeld-Trades: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
          </p>
          <p style={{ ...textStyle, marginBottom: 12 }}>
            Technischer Betrieb und Sicherheit der Plattform (Hosting, Server-Logs): Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).
          </p>
          <p style={textStyle}>
            Reichweiten-Analyse (PostHog): Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) — siehe Abschnitt „Analyse-Cookies“.
          </p>
        </div>

        {/* Hosting & Infrastruktur */}
        <div style={cardStyle}>
          <div style={labelStyle}>Hosting und technische Infrastruktur</div>
          <p style={{ ...textStyle, marginBottom: 12 }}>
            Wir setzen folgende Dienstleister als Auftragsverarbeiter ein:
          </p>
          <p style={{ ...textStyle, marginBottom: 12 }}>
            <strong>Supabase</strong> — Datenbank und Nutzer-Authentifizierung.<br />
            <strong>Vercel</strong> — Hosting und Ausführung der Anwendung.<br />
            <strong>Upstash (QStash)</strong> — zeitgesteuerte Hintergrundprozesse (z. B. Marktauflösung); verarbeitet keine Inhalte deiner Nutzerdaten, sondern löst nur Serverfunktionen zeitgesteuert aus.
          </p>
          <p style={textStyle}>
            Diese Anbieter können Daten auch außerhalb der EU/des EWR verarbeiten. In diesem Fall stellt der jeweilige Anbieter ein angemessenes Datenschutzniveau sicher, etwa über EU-Standardvertragsklauseln nach Art. 46 DSGVO.
          </p>
        </div>

        {/* Analyse-Cookies */}
        <div style={cardStyle}>
          <div style={labelStyle}>Analyse-Cookies (PostHog)</div>
          <p style={{ ...textStyle, marginBottom: 12 }}>
            Mit deiner Einwilligung nutzen wir PostHog (EU-Hosting) zur Analyse der Website-Nutzung (z. B. besuchte Seiten). PostHog wird erst geladen, nachdem du im Cookie-Banner „Akzeptieren“ gewählt hast. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO i. V. m. § 25 TTDSG.
          </p>
          <p style={{ ...textStyle, marginBottom: 16 }}>
            Du kannst deine Einwilligung jederzeit widerrufen:
          </p>
          <button
            onClick={resetCookieConsent}
            style={{
              background: 'var(--accent, #6366f1)', border: 'none', color: '#fff',
              borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cookie-Einstellungen zurücksetzen
          </button>
        </div>

        {/* E-Mail-Versand */}
        <div style={cardStyle}>
          <div style={labelStyle}>E-Mail-Versand</div>
          <p style={{ ...textStyle, marginBottom: 12 }}>
            Für transaktionale E-Mails (z. B. Kontobestätigung) nutzen wir Resend als Auftragsverarbeiter.
          </p>
          <p style={textStyle}>
            Eingehende E-Mails an support@moebiusmarkets.de und benno@moebiusmarkets.de werden über Cloudflare Email Routing weitergeleitet.
          </p>
        </div>

        {/* Speicherdauer */}
        <div style={cardStyle}>
          <div style={labelStyle}>Speicherdauer</div>
          <p style={textStyle}>
            Konto- und Nutzungsdaten speichern wir, solange dein Konto besteht. Nach Löschung deines Kontos werden deine personenbezogenen Daten gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
          </p>
        </div>

        {/* Rechte */}
        <div style={cardStyle}>
          <div style={labelStyle}>Deine Rechte</div>
          <p style={{ ...textStyle, marginBottom: 12 }}>
            Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21) gegen die Verarbeitung deiner Daten.
          </p>
          <p style={textStyle}>
            Du hast außerdem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, z. B. beim Hessischen Beauftragten für Datenschutz und Informationsfreiheit.
          </p>
        </div>

        {/* Mindestalter */}
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <div style={labelStyle}>Mindestalter</div>
          <p style={textStyle}>
            Möbius richtet sich nicht an Personen unter 16 Jahren. Die Registrierung setzt die Bestätigung eines Mindestalters von 16 Jahren voraus (Art. 8 DSGVO). Weitere Nutzungsregeln findest du in unseren <a href="/agb" style={{ color: 'var(--accent, #6366f1)' }}>AGB</a>.
          </p>
        </div>

      </div>
    </div>
  )
}
