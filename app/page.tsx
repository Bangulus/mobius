import HomeClient, { Market } from './components/HomeClient'
import type { Metadata } from 'next'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const metadata: Metadata = {
  title: 'Möbius – Prediction Markets auf Deutsch',
  description: 'Die deutschsprachige Prediction-Markets-Plattform. Handle mit Dukaten auf Politik, Bundesliga, Krypto und Wirtschaft – 100% Spielgeld, ohne Echtgeld-Risiko.',
}

async function getMarkets(): Promise<Market[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/markets?status=eq.open&select=*&order=created_at.desc`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store',
      }
    )
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export default async function Page() {
  const markets = await getMarkets()
  return <HomeClient initialMarkets={markets} />
}
