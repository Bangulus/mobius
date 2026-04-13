'use client';

import { useState } from 'react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function signUp() {
    setLoading(true);
    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (data.user) {
      await fetch(`${supabaseUrl}/rest/v1/users`, {
        method: 'POST',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ id: data.user.id, email: data.user.email, username: username || email.split('@')[0] }),
      });
      setMessage('Konto erstellt. Du kannst dich jetzt anmelden.');
    } else {
      setMessage(data.msg || 'Fehler beim Registrieren.');
    }
    setLoading(false);
  }

  async function signIn() {
    setLoading(true);
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (data.access_token) {
      const url = `/?token=${data.access_token}&user_id=${data.user.id}`;
      setTimeout(() => { window.location.href = url; }, 2000);
      setMessage('Login erfolgreich! Du wirst weitergeleitet...');
    } else {
      setMessage(data.error_description || 'Fehler beim Anmelden.');
    }
    setLoading(false);
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '400px' }}>
      <h1>Möbius</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input type="email" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '0.5rem', fontSize: '1rem', borderRadius: '6px', border: '1px solid #ccc' }} />
        <input type="password" placeholder="Passwort" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '0.5rem', fontSize: '1rem', borderRadius: '6px', border: '1px solid #ccc' }} />
        <input type="text" placeholder="Benutzername (nur bei Registrierung)" value={username} onChange={(e) => setUsername(e.target.value)} style={{ padding: '0.5rem', fontSize: '1rem', borderRadius: '6px', border: '1px solid #ccc' }} />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={signIn} disabled={loading} style={{ flex: 1, padding: '0.5rem', background: '#0f3460', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}>Anmelden</button>
          <button type="button" onClick={signUp} disabled={loading} style={{ flex: 1, padding: '0.5rem', background: '#444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}>Registrieren</button>
        </div>
        {message && <p style={{ color: '#666' }}>{message}</p>}
      </div>
    </main>
  );
}