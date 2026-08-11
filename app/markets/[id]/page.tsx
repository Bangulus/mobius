import type { Metadata } from 'next';
import MarketPageClient from './MarketPageClient';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface MarketMeta {
  question: string;
  short_label?: string;
  description?: string;
  category?: string;
}

async function getMarketMeta(id: string): Promise<MarketMeta | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/markets?id=eq.${id}&select=question,short_label,description,category`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store',
      }
    );
    const data = await res.json();
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}

// Schneidet an der letzten Wortgrenze vor maxLength ab, statt mitten im Wort.
function truncateAtWord(text: string, maxLength: number): string {
  const cleaned = text.trim();
  if (cleaned.length <= maxLength) return cleaned;
  const cut = cleaned.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  const safeCut = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${safeCut.trim()}…`;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const market = await getMarketMeta(params.id);

  if (!market) {
    return {
      title: 'Markt nicht gefunden | Möbius',
      description: 'Dieser Markt existiert nicht oder wurde entfernt.',
    };
  }

  const rawTitle = market.short_label || market.question;
  const title = `${truncateAtWord(rawTitle, 60)} | Möbius`;

  const rawDescription =
    market.description && market.description.length > 20
      ? market.description.replace(/\s+/g, ' ')
      : `Wie wahrscheinlich ist „${market.question}"? Handle mit Dukaten auf Möbius, dem deutschen Prognosemarkt.`;
  const description = truncateAtWord(rawDescription, 155);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'de_DE',
      siteName: 'Möbius',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default function Page() {
  return <MarketPageClient />;
}
