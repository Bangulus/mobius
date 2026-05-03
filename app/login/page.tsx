'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAuth(action: 'signin' | 'signup') {
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, email, password, username }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || 'Ein Fehler ist aufgetreten.');
        setLoading(false);
        return;
      }

      if (action === 'signup') {
        setMessage(data.message);
      } else {
        // Token in sessionStorage — nie in URL
        sessionStorage.setItem('access_token', data.access_token);
        sessionStorage.setItem('user_id', data.user_id);
        setMessage('Login erfolgreich! Du wirst weitergeleitet...');
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      }
    } catch {
      setMessage('Netzwerkfehler. Bitte versuche es erneut.');
    }

    setLoading(false);
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '400px' }}>
      <h1>Möbius</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input
          type="email"
          placeholder="E-Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          style={{ padding: '0.5rem', fontSize: '1rem', borderRadius: '6px', border: '1px solid #ccc' }}
        />
        <input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          maxLength={128}
          style={{ padding: '0.5rem', fontSize: '1rem', borderRadius: '6px', border: '1px solid #ccc' }}
        />
        <input
          type="text"
          placeholder="Benutzername (nur bei Registrierung)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={50}
          style={{ padding: '0.5rem', fontSize: '1rem', borderRadius: '6px', border: '1px solid #ccc' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => handleAuth('signin')}
            disabled={loading}
            style={{ flex: 1, padding: '0.5rem', background: '#0f3460', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}
          >
            Anmelden
          </button>
          <button
            type="button"
            onClick={() => handleAuth('signup')}
            disabled={loading}
            style={{ flex: 1, padding: '0.5rem', background: '#444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}
          >
            Registrieren
          </button>
        </div>
        {message && <p style={{ color: '#666' }}>{message}</p>}
      </div>
    </main>
  );
}
