'use client';

import { useState } from 'react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface Props {
  userId: string;
  token: string;
  displayName: string;
  avatarUrl: string;
  balance: number | null;
  onUsernameChange: (name: string) => void;
  onAvatarChange: (url: string) => void;
}

export default function ProfileView({ userId, token, displayName, avatarUrl, balance, onUsernameChange, onAvatarChange }: Props) {
  const [newUsername, setNewUsername] = useState(displayName);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  async function saveUsername() {
    if (!newUsername.trim()) return;
    setSavingUsername(true);
    const response = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ username: newUsername.trim() }),
    });
    if (response.ok) {
      onUsernameChange(newUsername.trim());
      setProfileMessage('Benutzername erfolgreich gespeichert!');
    } else {
      setProfileMessage('Fehler beim Speichern.');
    }
    setSavingUsername(false);
    setTimeout(() => setProfileMessage(''), 3000);
  }

  async function uploadAvatar(file: File) {
    setUploadingAvatar(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}.${fileExt}`;
    const uploadResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/avatars/${fileName}`,
      {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': file.type,
          'x-upsert': 'true',
        },
        body: file,
      }
    );
    if (uploadResponse.ok) {
      const newAvatarUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${fileName}?t=${Date.now()}`;
      await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ avatar_url: newAvatarUrl }),
      });
      onAvatarChange(newAvatarUrl);
      setProfileMessage('Profilbild erfolgreich gespeichert!');
    } else {
      const errorText = await uploadResponse.text();
      setProfileMessage(`Fehler: ${uploadResponse.status} - ${errorText}`);
    }
    setUploadingAvatar(false);
    setTimeout(() => setProfileMessage(''), 5000);
  }

  return (
    <div style={{ maxWidth: '400px' }}>
      <h2>👤 Mein Profil</h2>
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '0.5rem' }} />
          ) : (
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 0.5rem' }}>
              👤
            </div>
          )}
          <div>
            <label style={{ display: 'inline-block', padding: '0.3rem 1rem', background: '#0f3460', color: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
              {uploadingAvatar ? 'Wird hochgeladen...' : 'Profilbild ändern'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) uploadAvatar(e.target.files[0]); }} />
            </label>
          </div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.3rem' }}>Benutzername</label>
          <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }} />
        </div>
        <button onClick={saveUsername} disabled={savingUsername} style={{ width: '100%', padding: '0.5rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem' }}>
          {savingUsername ? 'Wird gespeichert...' : 'Benutzername speichern'}
        </button>
        {profileMessage && <p style={{ color: profileMessage.startsWith('Fehler') ? '#dc2626' : '#16a34a', textAlign: 'center', marginTop: '0.5rem', fontSize: '0.9rem' }}>{profileMessage}</p>}
      </div>
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
        <div style={{ color: '#666', fontSize: '0.9rem' }}>💰 Guthaben</div>
        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#16a34a' }}>
          {balance?.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Dukaten
        </div>
      </div>
    </div>
  );
}
