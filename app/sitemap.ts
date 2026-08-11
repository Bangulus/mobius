import type { MetadataRoute } from 'next';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BASE_URL = 'https://www.moebiusmarkets.de';

interface SitemapMarket {
  id: string;
  closes_at: string;
}

// Holt alle Märkte, die dauerhaften Referenzwert haben:
// - Manuell erstellte Märkte (is_auto=false): Politik, Wirtschaft, Tech, Geopolitik, Entertainment, Kultur
// - Fussball (match_id gesetzt), Finanzen, Formel 1 (is_auto=true, aber langlebig)
// Bewusst ausgeschlossen: Krypto-3-Minuten-Märkte und tägliche Wetter-Märkte —
// diese sterben permanent bzw. werden ständig neu erstellt, Indexierung wäre Crawl-Verschwendung.
async function getIndexableMarkets(): Promise<SitemapMarket[]> {
  try {
    const manualRes = await fetch(
      `${SUPABASE_URL}/rest/v1/markets?is_auto=eq.false&select=id,closes_at&order=closes_at.desc&limit=2000`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store',
      }
    );
    const manual = await manualRes.json();

    const autoRes = await fetch(
      `${SUPABASE_URL}/rest/v1/markets?is_auto=eq.true&select=id,closes_at,category,match_id&order=closes_at.desc&limit=2000`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        cache: 'no-store',
      }
    );
    const auto = await autoRes.json();

    const KEEP_AUTO_CATEGORIES = new Set(['finance', 'Finanzen', 'formula1']);
    const filteredAuto = (auto ?? []).filter(
      (m: { category?: string; match_id?: string }) => {
        if (m.match_id) return true; // Fussball
        return KEEP_AUTO_CATEGORIES.has(m.category ?? '');
      }
    );

    return [...(manual ?? []), ...filteredAuto];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const markets = await getIndexableMarkets();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: 'always', priority: 1 },
    { url: `${BASE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/faq`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/raenge`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${BASE_URL}/bewertungen`, changeFrequency: 'monthly', priority: 0.4 },
  ];

  const marketPages: MetadataRoute.Sitemap = markets.map((m) => ({
    url: `${BASE_URL}/markets/${m.id}`,
    lastModified: new Date(m.closes_at),
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  return [...staticPages, ...marketPages];
}
