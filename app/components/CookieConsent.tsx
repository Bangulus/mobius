'use client';

import { useEffect, useState } from 'react';
import { initPostHogIfConsented } from './PostHogClientProvider';

const CONSENT_KEY = 'mobius_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(CONSENT_KEY)) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    initPostHogIfConsented();
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, 'declined');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      background: 'var(--primary, #1a1f3c)',
      borderTop: '0.5px solid rgba(255,255,255,0.08)',
      padding: '16px 20px',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, maxWidth: 560 }}>
        Wir nutzen Analyse-Cookies (PostHog), um Möbius zu verbessern. Diese werden nur mit deiner Zustimmung geladen.
        Details in der{' '}
        <a href="/datenschutz" style={{ color: '#fff', textDecoration: 'underline' }}>
          Datenschutzerklärung
        </a>.
      </p>
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <button
          onClick={decline}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.25)',
            color: 'rgba(255,255,255,0.8)',
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Ablehnen
        </button>
        <button
          onClick={accept}
          style={{
            background: 'var(--accent, #6366f1)',
            border: 'none',
            color: '#fff',
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Akzeptieren
        </button>
      </div>
    </div>
  );
}
