import type { Metadata } from 'next';
import BewertungenPageClient from './BewertungenPageClient';

const BASE_URL = 'https://www.moebiusmarkets.de';

export const metadata: Metadata = {
  title: 'Bewertungen – Das sagen Nutzer über Möbius',
  description: 'Erfahrungsberichte und Bewertungen von Nutzern der deutschsprachigen Prediction-Market-Plattform Möbius.',
  alternates: {
    canonical: `${BASE_URL}/bewertungen`,
  },
  openGraph: {
    title: 'Bewertungen – Das sagen Nutzer über Möbius',
    description: 'Erfahrungsberichte und Bewertungen von Nutzern der deutschsprachigen Prediction-Market-Plattform Möbius.',
    type: 'website',
    locale: 'de_DE',
    siteName: 'Möbius',
  },
  twitter: {
    card: 'summary',
    title: 'Bewertungen – Das sagen Nutzer über Möbius',
    description: 'Erfahrungsberichte und Bewertungen von Nutzern der deutschsprachigen Prediction-Market-Plattform Möbius.',
  },
};

export default function Page() {
  return <BewertungenPageClient />;
}
