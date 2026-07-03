import { NextResponse } from 'next/server'
import { XMLParser } from 'fast-xml-parser'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!

function isAuthorized(request: Request): boolean {
  const url         = new URL(request.url)
  const querySecret = url.searchParams.get('secret')
  const authHeader  = request.headers.get('authorization')
  const CRON_SECRET = process.env.CRON_SECRET!
  return authHeader === `Bearer ${CRON_SECRET}` || querySecret === CRON_SECRET
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
})

type NewsItem = {
  title: string
  link: string
  published_at: string
  source_category: string
}

const FEEDS: { url: string; category: string; type: 'rss' | 'atom' }[] = [
  { url: 'https://www.tagesschau.de/xml/rss2/', category: 'politik', type: 'rss' },
  { url: 'https://www.tagesschau.de/xml/rss2_ausland/', category: 'geopolitik', type: 'rss' },
  { url: 'https://www.tagesschau.de/xml/rss2_wirtschaft/', category: 'wirtschaft', type: 'rss' },
  { url: 'https://www.heise.de/rss/heise-atom.xml', category: 'tech', type: 'atom' },
]

// Fast-xml-parser gibt bei CDATA/gemischtem Inhalt manchmal ein Objekt
// mit '#text' statt eines reinen Strings zurück — hier vereinheitlicht.
function extractText(val: unknown): string {
  if (typeof val === 'string') return val
  if (val && typeof val === 'object' && '#text' in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>)['#text'])
  }
  return ''
}

function parseRss(xml: string, category: string): NewsItem[] {
  const data = parser.parse(xml)
  const rawItems = data?.rss?.channel?.item
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []

  const result: NewsItem[] = []
  for (const item of items) {
    const title = extractText(item.title)
    const link = extractText(item.link)
    const pubDate = extractText(item.pubDate)
    if (!title || !link) continue

    const parsedDate = pubDate ? new Date(pubDate) : new Date()
    result.push({
      title,
      link,
      published_at: isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString(),
      source_category: category,
    })
  }
  return result
}

function parseAtom(xml: string, category: string): NewsItem[] {
  const data = parser.parse(xml)
  const rawEntries = data?.feed?.entry
  const entries = Array.isArray(rawEntries) ? rawEntries : rawEntries ? [rawEntries] : []

  const result: NewsItem[] = []
  for (const entry of entries) {
    const title = extractText(entry.title)

    let link = ''
    if (Array.isArray(entry.link)) {
      const alt = entry.link.find((l: Record<string, unknown>) => l['@_rel'] === 'alternate') || entry.link[0]
      link = alt?.['@_href'] || ''
    } else if (entry.link) {
      link = entry.link['@_href'] || extractText(entry.link)
    }

    const updated = extractText(entry.updated) || extractText(entry.published)
    if (!title || !link) continue

    const parsedDate = updated ? new Date(updated) : new Date()
    result.push({
      title,
      link,
      published_at: isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString(),
      source_category: category,
    })
  }
  return result
}

async function insertNewsItems(items: NewsItem[]) {
  if (items.length === 0) return { inserted: 0 }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/news_items`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(items),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Insert failed (${res.status}): ${errorText}`)
  }

  return { inserted: items.length }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, unknown> = {}

  for (const feed of FEEDS) {
    try {
      const res = await fetch(feed.url, { cache: 'no-store' })
      if (!res.ok) {
        results[feed.category] = { error: `Feed-Fetch fehlgeschlagen: ${res.status}` }
        continue
      }
      const xml = await res.text()
      const items = feed.type === 'rss' ? parseRss(xml, feed.category) : parseAtom(xml, feed.category)
      const insertResult = await insertNewsItems(items)
      results[feed.category] = { fetched: items.length, ...insertResult }
    } catch (e) {
      results[feed.category] = { error: String(e) }
    }
  }

  const hadErrors = Object.values(results).some(r => r && typeof r === 'object' && 'error' in r)

  return NextResponse.json({ ok: !hadErrors, results })
}

export async function POST(request: Request) {
  return GET(request)
}
