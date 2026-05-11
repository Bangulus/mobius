import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ error: 'No symbol' }, { status: 400 })

  try {
    const encoded = encodeURIComponent(symbol)
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1m&range=1d`,
      {
        cache: 'no-store',
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }
    )
    if (!res.ok) return NextResponse.json({ error: 'Yahoo error' }, { status: 502 })
    const data = await res.json()
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
    if (!price) return NextResponse.json({ error: 'No price' }, { status: 404 })
    return NextResponse.json({ price })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
