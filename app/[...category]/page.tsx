import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import HomeClient, { Market } from '../components/HomeClient';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BASE_URL = 'https://www.moebiusmarkets.de';

interface CategoryDef {
  categoryId: string;
  title: string;
  description: string;
  // Gesetzt, wenn diese URL inhaltlich identisch zu einer spezifischeren URL ist
  // (z. B. /politik zeigt dasselbe wie /politik/deutschland) — canonical zeigt dann dorthin.
  canonicalPath?: string;
}

// Metadata-Texte 1:1 aus der bisherigen app/kategorie/[slug]/page.tsx CATEGORY_MAP übernommen,
// nur neu verschlüsselt auf die verschachtelten Pfade. Drei Einträge (sport, sport/fussball,
// finanzen/woche) sind neu formuliert, da es dafür vorher keine eigene URL/Metadata gab.
// politik + politik/deutschland: Title/Description am 01.09.2026 geschärft, damit die
// Marken-Query "Möbius Markets" bei Google auf diese Seite statt auf /bewertungen zeigt.
const CATEGORY_MAP: Record<string, CategoryDef> = {
  'politik': {
    categoryId: 'Politik-Deutschland',
    title: 'Möbius Markets – Politik-Wetten Deutschland',
    description: 'Möbius Markets: der deutschsprachige Prediction-Market. Wie wahrscheinlich sind aktuelle politische Entwicklungen in Deutschland?',
    canonicalPath: 'politik/deutschland',
  },
  'politik/deutschland': {
    categoryId: 'Politik-Deutschland',
    title: 'Möbius Markets – Politik-Wetten Deutschland',
    description: 'Möbius Markets: der deutschsprachige Prediction-Market. Wie wahrscheinlich sind aktuelle politische Entwicklungen in Deutschland?',
  },
  'politik/usa': {
    categoryId: 'Politik-USA',
    title: 'Politik-Wetten USA | Möbius',
    description: 'Prognosemärkte zur US-Politik – aktuelle Wahrscheinlichkeiten auf Möbius, dem deutschsprachigen Prognosemarkt.',
  },
  'sport': {
    categoryId: 'Sport',
    title: 'Sport-Wetten | Möbius',
    description: 'Prognosemärkte zu Fußball und Formel 1 – aktuelle Marktwahrscheinlichkeiten auf Möbius.',
  },
  'sport/fussball': {
    categoryId: 'Fußball',
    title: 'Fußball-Wetten | Möbius',
    description: 'Prognosemärkte zu Fußball-Spielen und -Ergebnissen auf Möbius, der deutschsprachigen Prediction-Markets-Plattform.',
  },
  'sport/bundesliga': {
    categoryId: 'Bundesliga',
    title: 'Bundesliga-Wetten | Möbius',
    description: 'Wahrscheinlichkeiten für Bundesliga-Spiele – Sieg, Unentschieden oder Niederlage, eingeschätzt vom Markt.',
  },
  'sport/f1': {
    categoryId: 'F1',
    title: 'Formel-1-Wetten | Möbius',
    description: 'Wer wird Formel-1-Weltmeister? Prognosemärkte zur aktuellen Saison auf Möbius.',
  },
  'krypto': {
    categoryId: 'Krypto',
    title: 'Krypto-Märkte | Möbius',
    description: 'Live-Prognosemärkte zu Bitcoin, Ethereum, Solana und XRP auf Möbius.',
  },
  'wirtschaft': {
    categoryId: 'Wirtschaft',
    title: 'Wirtschafts-Wetten | Möbius',
    description: 'Prognosemärkte zu wirtschaftlichen Entwicklungen und Ereignissen in Deutschland und weltweit.',
  },
  'tech': {
    categoryId: 'Tech',
    title: 'Tech-Wetten | Möbius',
    description: 'Prognosemärkte zu Technologie-Themen und der Tech-Branche.',
  },
  'geopolitik': {
    categoryId: 'Geopolitik',
    title: 'Geopolitik-Wetten | Möbius',
    description: 'Prognosemärkte zu internationalen politischen Entwicklungen.',
  },
  'finanzen': {
    categoryId: 'Finanzen-Tag',
    title: 'Finanzmärkte | Möbius',
    description: 'Prognosen zu Aktien, Indizes und Rohstoffen – schließt der Kurs heute höher oder tiefer?',
    canonicalPath: 'finanzen/tag',
  },
  'finanzen/tag': {
    categoryId: 'Finanzen-Tag',
    title: 'Finanzmärkte | Möbius',
    description: 'Prognosen zu Aktien, Indizes und Rohstoffen – schließt der Kurs heute höher oder tiefer?',
  },
  'finanzen/woche': {
    categoryId: 'Finanzen-Woche',
    title: 'Finanzmärkte – Wochenausblick | Möbius',
    description: 'Prognosen zu Aktien, Indizes und Rohstoffen über die aktuelle Handelswoche – schließt der Kurs höher oder tiefer?',
  },
  'wetter': {
    categoryId: 'Wetter',
    title: 'Wetter-Wetten | Möbius',
    description: 'Wird es morgen wärmer? Tägliche Prognosemärkte zum Wetter in deutschen Städten.',
  },
  'entertainment': {
    categoryId: 'Entertainment',
    title: 'Entertainment-Wetten | Möbius',
    description: 'Prognosemärkte zu Filmen, Serien und Popkultur auf Möbius.',
  },
  'kultur': {
    categoryId: 'Kultur',
    title: 'Kultur-Wetten | Möbius',
    description: 'Prognosemärkte zu kulturellen Ereignissen und Trends.',
  },
};

function pathFromParams(category: string[]): string {
  return category.join('/');
}

export function generateStaticParams() {
  return Object.keys(CATEGORY_MAP).map((path) => ({ category: path.split('/') }));
}

export async function generateMetadata({
  params,
}: {
  params: { category: string[] };
}): Promise<Metadata> {
  const path = pathFromParams(params.category);
  const def = CATEGORY_MAP[path];
  if (!def) {
    return { title: 'Nicht gefunden | Möbius' };
  }
  const canonicalPath = def.canonicalPath ?? path;
  return {
    title: def.title,
    description: def.description,
    alternates: {
      canonical: `${BASE_URL}/${canonicalPath}`,
    },
    openGraph: {
      title: def.title,
      description: def.description,
      type: 'website',
      locale: 'de_DE',
      siteName: 'Möbius',
    },
    twitter: {
      card: 'summary',
      title: def.title,
      description: def.description,
    },
  };
}

async function getMarkets(): Promise<Market[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/markets?status=eq.open&select=*&order=created_at.desc`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store',
      }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export default async function Page({ params }: { params: { category: string[] } }) {
  const path = pathFromParams(params.category);
  const def = CATEGORY_MAP[path];
  if (!def) notFound();
  const markets = await getMarkets();
  return <HomeClient initialMarkets={markets} />;
}
