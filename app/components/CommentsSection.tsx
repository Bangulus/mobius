'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Comment {
  id: string
  market_id: string
  user_id: string
  content: string
  likes: number
  created_at: string
  username: string
  avatar_url: string | null
}

function getToken(): string | null {
  try {
    const saved = localStorage.getItem('mobius_session')
    if (!saved) return null
    return JSON.parse(saved).access_token ?? null
  } catch { return null }
}

function getCurrentUserId(): string | null {
  try {
    const saved = localStorage.getItem('mobius_session')
    if (!saved) return null
    return JSON.parse(saved).user_id ?? null
  } catch { return null }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'Gerade eben'
  if (mins < 60)  return `${mins} Min.`
  if (hours < 24) return `${hours} Std.`
  return `${days} Tag${days !== 1 ? 'en' : ''}`
}

function Avatar({ username, avatarUrl, size = 36 }: { username: string; avatarUrl: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false)
  const initials = username.slice(0, 2).toUpperCase()
  const color    = `hsl(${username.charCodeAt(0) * 37 % 360}, 55%, 48%)`

  if (avatarUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={username}
        onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.36), fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

export default function CommentsSection({ marketId }: { marketId: string }) {
  const router = useRouter()
  const [comments, setComments]           = useState<Comment[]>([])
  const [loading, setLoading]             = useState(true)
  const [text, setText]                   = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [error, setError]                 = useState('')
  const [likedIds, setLikedIds]           = useState<Set<string>>(new Set())
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    setCurrentUserId(getCurrentUserId())
  }, [])

  const loadComments = useCallback(async () => {
    const res  = await fetch(`/api/comments?market_id=${marketId}`)
    const data = await res.json()
    if (Array.isArray(data)) setComments(data)
    setLoading(false)
  }, [marketId])

  useEffect(() => { loadComments() }, [loadComments])

  async function handleSubmit() {
    if (!text.trim()) return
    setSubmitting(true); setError('')
    const token = getToken()
    if (!token) { setError('Bitte zuerst anmelden.'); setSubmitting(false); return }

    const res  = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ market_id: marketId, content: text.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Fehler'); setSubmitting(false); return }

    setComments(prev => [data, ...prev])
    setText('')
    setSubmitting(false)
  }

  async function handleLike(commentId: string) {
    const token = getToken()
    if (!token) return
    const alreadyLiked = likedIds.has(commentId)
    setLikedIds(prev => {
      const next = new Set(prev)
      alreadyLiked ? next.delete(commentId) : next.add(commentId)
      return next
    })
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, likes: alreadyLiked ? c.likes - 1 : c.likes + 1 } : c
    ))
    const res = await fetch('/api/comments/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ comment_id: commentId }),
    })
    if (!res.ok) {
      setLikedIds(prev => {
        const next = new Set(prev)
        alreadyLiked ? next.add(commentId) : next.delete(commentId)
        return next
      })
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, likes: alreadyLiked ? c.likes + 1 : c.likes - 1 } : c
      ))
    }
  }

  const isLoggedIn = !!currentUserId

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        Kommentare
        {!loading && <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>({comments.length})</span>}
      </div>

      {/* Eingabe */}
      {isLoggedIn ? (
        <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Kommentar hinzufügen…"
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text)', fontSize: 14, resize: 'none',
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{text.length}/500</span>
            <button
              onClick={handleSubmit}
              disabled={submitting || !text.trim()}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: text.trim() ? 'var(--accent)' : 'var(--border)',
                color: text.trim() ? '#fff' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 700, transition: 'background 0.15s', fontFamily: 'inherit',
              }}
            >
              {submitting ? 'Wird gesendet…' : 'Absenden'}
            </button>
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--no)' }}>{error}</div>}
        </div>
      ) : (
        <div style={{ marginBottom: 24, padding: '14px 16px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)' }}>
          Bitte anmelden um zu kommentieren.
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>Lädt…</div>
      ) : comments.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
          Noch keine Kommentare. Sei der Erste!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {comments.map((c, i) => {
            const isOwn  = c.user_id === currentUserId
            const liked  = likedIds.has(c.id)
            const isLast = i === comments.length - 1
            return (
              <div key={c.id} style={{
                display: 'flex', gap: 12, padding: '16px 0',
                borderBottom: isLast ? 'none' : '1px solid var(--border)',
              }}>
                {/* Avatar — klickbar */}
                <div
                  onClick={() => router.push(`/profil/${encodeURIComponent(c.username)}`)}
                  style={{ cursor: 'pointer', flexShrink: 0 }}
                >
                  <Avatar username={c.username} avatarUrl={c.avatar_url} size={36} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                    {/* Username — klickbar */}
                    <span
                      onClick={() => router.push(`/profil/${encodeURIComponent(c.username)}`)}
                      style={{
                        fontSize: 13, fontWeight: 700, color: 'var(--text)',
                        cursor: 'pointer', transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
                    >
                      {c.username}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{timeAgo(c.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.55, wordBreak: 'break-word' }}>{c.content}</div>
                  <div style={{ marginTop: 8 }}>
                    {isOwn ? (
                      <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
                        {c.likes > 0 ? `♥ ${c.likes}` : ''}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleLike(c.id)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 13, color: liked ? 'var(--no)' : 'var(--text-muted)',
                          padding: '2px 0', fontWeight: liked ? 700 : 400,
                          transition: 'color 0.15s', fontFamily: 'inherit',
                        }}
                      >
                        {liked ? '♥' : '♡'} {c.likes > 0 ? c.likes : ''}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
