import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import HomeClient from '../../components/HomeClient';

const BASE_URL = 'https://www.moebiusmarkets.de';

interface CategoryDef {
  categoryId: string;
  title: string;
  description: string;
}

// Zuordnung Slug -> interne Kategorie-ID (siehe MOBILE_CAT_PILLS / NAV_ITEMS in HomeClient.tsx)
// plus individuelle Metadata pro Kategorie-Landingpage.
const CATEGORY_MAP: Record<string, CategoryDef> = {
  'politik-deutschland': {
    categoryId: 'Politik-Deutschland',
    title: 'Politik-Wetten Deutschland | Möbius',
    description: 'Wie wahrscheinlich sind aktuelle politische Entwicklungen in Deutschland? Aktuelle Markteinschätzungen auf Möbius.',
  },
  'politik-usa': {
    categoryId: 'Politik-USA',
    title: 'Politik-Wetten USA | Möbius',
    description: 'Prognosemärkte zur US-Politik – aktuelle Wahrscheinlichkeiten auf Möbius, dem deutschsprachigen Prognosemarkt.',
  },
  'bundesliga': {
    categoryId: 'Bundesliga',
    title: 'Bundesliga-Wetten | Möbius',
    description: 'Wahrscheinlichkeiten für Bundesliga-Spiele – Sieg, Unentschieden oder Niederlage, eingeschätzt vom Markt.',
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
  'finanzen': {
    categoryId: 'Finanzen-Tag',
    title: 'Finanzmärkte | Möbius',
    description: 'Prognosen zu Aktien, Indizes und Rohstoffen – schließt der Kurs heute höher oder tiefer?',
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
  'formel-1': {
    categoryId: 'F1',
    title: 'Formel-1-Wetten | Möbius',
    description: 'Wer wird Formel-1-Weltmeister? Prognosemärkte zur aktuellen Saison auf Möbius.',
  },
  'kultur': {
    categoryId: 'Kultur',
    title: 'Kultur-Wetten | Möbius',
    description: 'Prognosemärkte zu kulturellen Ereignissen und Trends.',
  },
};

export function generateStaticParams() {
  return Object.keys(CATEGORY_MAP).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const def = CATEGORY_MAP[params.slug];
  if (!def) {
    return { title: 'Nicht gefunden | Möbius' };
  }
  return {
    title: def.title,
    description: def.description,
    alternates: {
      canonical: `${BASE_URL}/kategorie/${params.slug}`,
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

export default function Page({ params }: { params: { slug: string } }) {
  const def = CATEGORY_MAP[params.slug];
  if (!def) notFound();
  return <HomeClient initialCategory={def.categoryId} />;
}
