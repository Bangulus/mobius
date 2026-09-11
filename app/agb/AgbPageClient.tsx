'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppShell } from '../components/AppShellContext'

export default function AgbPageClient() {
  const router = useRouter()
  const { setPageAction } = useAppShell()

  useEffect(() => {
    setPageAction(
      <button className="nav-pill" onClick={() => router.push('/')} style={{ fontSize: 13 }}>← Zurück</button>
    )
    return () => setPageAction(null)
  }, [router, setPageAction])

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
            Nutzungsbedingungen
          </h1>
        </div>

        {/* Geltungsbereich */}
        <div style={cardStyle}>
          <div style={labelStyle}>1. Geltungsbereich</div>
          <p style={textStyle}>
            Diese Nutzungsbedingungen gelten für die Nutzung von Möbius (moebiusmarkets.de), einer Spielgeld-Plattform für Prognosemärkte, betrieben von Benno Möbius (siehe <a href="/impressum" style={{ color: 'var(--accent, #6366f1)' }}>Impressum</a>).
          </p>
        </div>

        {/* Leistungsbeschreibung */}
        <div style={cardStyle}>
          <div style={labelStyle}>2. Leistungsbeschreibung</div>
          <p style={textStyle}>
            Möbius ist eine reine Spielgeld-Plattform. Die verwendete Währung „Dukaten“ (₫) hat keinen Geldwert, kann nicht gekauft, verkauft oder ausgezahlt werden und ist nicht mit echtem Geld gleichzusetzen. Es findet kein Glücksspiel im Sinne des Glücksspielstaatsvertrags statt.
          </p>
        </div>

        {/* Registrierung & Mindestalter */}
        <div style={cardStyle}>
          <div style={labelStyle}>3. Registrierung und Mindestalter</div>
          <p style={textStyle}>
            Die Registrierung erfordert eine gültige E-Mail-Adresse und ist Personen ab 16 Jahren vorbehalten. Mit der Registrierung bestätigst du, mindestens 16 Jahre alt zu sein.
          </p>
        </div>

        {/* Pflichten der Nutzer */}
        <div style={cardStyle}>
          <div style={labelStyle}>4. Pflichten bei der Nutzung</div>
          <p style={{ ...textStyle, marginBottom: 12 }}>
            Jede Person darf nur ein Konto führen. Die Erstellung mehrerer Konten, Marktmanipulation sowie jede Form des Missbrauchs der Plattform sind untersagt.
          </p>
          <p style={textStyle}>
            Bei Verstößen können wir Konten einschränken, sperren oder löschen.
          </p>
        </div>

        {/* Haftung */}
        <div style={cardStyle}>
          <div style={labelStyle}>5. Haftung und Verfügbarkeit</div>
          <p style={{ ...textStyle, marginBottom: 12 }}>
            Möbius wird mit größtmöglicher Sorgfalt betrieben, es besteht jedoch kein Anspruch auf ununterbrochene Verfügbarkeit der Plattform.
          </p>
          <p style={textStyle}>
            Da es sich um Spielgeld ohne realen Wert handelt, entsteht durch Verluste innerhalb des Spiels kein finanzieller Schaden. Für Schäden, die durch die Nutzung der Plattform entstehen, haften wir nur bei Vorsatz oder grober Fahrlässigkeit.
          </p>
        </div>

        {/* Änderungen */}
        <div style={cardStyle}>
          <div style={labelStyle}>6. Änderungen dieser Nutzungsbedingungen</div>
          <p style={textStyle}>
            Wir können diese Nutzungsbedingungen bei Bedarf anpassen, etwa bei neuen Funktionen der Plattform. Die jeweils aktuelle Fassung ist auf dieser Seite abrufbar.
          </p>
        </div>

        {/* Recht */}
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <div style={labelStyle}>7. Anwendbares Recht</div>
          <p style={textStyle}>
            Es gilt deutsches Recht.
          </p>
        </div>

      </div>
    </div>
  )
}
