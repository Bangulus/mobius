import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// In-memory Rate Limiter (reset bei Serverrestart — reicht für Hobby-Tier)
const attempts = new Map<string, { count: number; resetAt: number }>();

function getRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 Minuten
  const maxAttempts = 5;

  const entry = attempts.get(ip);

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: maxAttempts - entry.count };
}

function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function validatePassword(password: string): boolean {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 6) return false;
  if (password.length > 128) return false;
  return true;
}

function validateUsername(username: string): boolean {
  if (!username || typeof username !== 'string') return false;
  if (username.length > 50) return false;
  const usernameRegex = /^[a-zA-Z0-9_\-äöüÄÖÜß]+$/;
  return usernameRegex.test(username.trim());
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  const { allowed, remaining } = getRateLimit(ip);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Zu viele Versuche. Bitte warte 15 Minuten.' },
      {
        status: 429,
        headers: { 'Retry-After': '900', 'X-RateLimit-Remaining': '0' },
      }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  const { action, email, password, username } = body as {
    action: string;
    email: string;
    password: string;
    username?: string;
  };

  if (!validateEmail(email)) {
    return NextResponse.json(
      { error: 'Ungültige E-Mail-Adresse.' },
      { status: 400 }
    );
  }

  if (!validatePassword(password)) {
    return NextResponse.json(
      { error: 'Passwort muss 6–128 Zeichen lang sein.' },
      { status: 400 }
    );
  }

  if (action === 'signup') {
    if (username && !validateUsername(username)) {
      return NextResponse.json(
        { error: 'Benutzername enthält ungültige Zeichen (max. 50 Zeichen).' },
        { status: 400 }
      );
    }

    const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const signupData = await signupRes.json();

    if (!signupData.user) {
      return NextResponse.json(
        { error: signupData.msg || 'Fehler beim Registrieren.' },
        { status: 400 }
      );
    }

    await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        id: signupData.user.id,
        email: signupData.user.email,
        username: username?.trim() || email.split('@')[0].slice(0, 30),
      }),
    });

    return NextResponse.json(
      { message: 'Konto erstellt. Du kannst dich jetzt anmelden.' },
      { headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
  }

  if (action === 'signin') {
    const signinRes = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password }),
      }
    );

    const signinData = await signinRes.json();

    if (!signinData.access_token) {
      return NextResponse.json(
        { error: signinData.error_description || 'Fehler beim Anmelden.' },
        { status: 401 }
      );
    }

    // Token nie in URL — nur im Response-Body zurückgeben
    return NextResponse.json(
      {
        access_token: signinData.access_token,
        user_id: signinData.user.id,
      },
      { headers: { 'X-RateLimit-Remaining': String(remaining) } }
    );
  }

  return NextResponse.json({ error: 'Unbekannte Aktion.' }, { status: 400 });
}
