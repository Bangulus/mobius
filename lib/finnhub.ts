// lib/finnhub.ts
// Preisquelle: Yahoo Finance (kein API Key, kein Vercel-Block)

export type FinanceAsset = {
  symbol: string
  yahooSymbol: string
  label: string
  category: 'index' | 'stock' | 'commodity' | 'forex'
  tradingHours: {
    timezone: 'Europe/Berlin'
    open: string
    close: string
    days: number[]
  }
}

export const FINANCE_ASSETS: FinanceAsset[] = [
  {
    symbol: '^GDAXI',
    yahooSymbol: '%5EGDAXI',
    label: 'DAX',
    category: 'index',
    tradingHours: { timezone: 'Europe/Berlin', open: '09:00', close: '17:30', days: [1,2,3,4,5] }
  },
  {
    symbol: '^GSPC',
    yahooSymbol: '%5EGSPC',
    label: 'S&P 500',
    category: 'index',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: '^NDX',
    yahooSymbol: '%5ENDX',
    label: 'NASDAQ 100',
    category: 'index',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: '^STOXX50E',
    yahooSymbol: '%5ESTOXX50E',
    label: 'Euro Stoxx 50',
    category: 'index',
    tradingHours: { timezone: 'Europe/Berlin', open: '09:00', close: '17:30', days: [1,2,3,4,5] }
  },
  {
    symbol: 'NVDA',
    yahooSymbol: 'NVDA',
    label: 'NVIDIA',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: 'AAPL',
    yahooSymbol: 'AAPL',
    label: 'Apple',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: 'MSFT',
    yahooSymbol: 'MSFT',
    label: 'Microsoft',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: 'GOOGL',
    yahooSymbol: 'GOOGL',
    label: 'Alphabet',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: 'AMZN',
    yahooSymbol: 'AMZN',
    label: 'Amazon',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: 'META',
    yahooSymbol: 'META',
    label: 'Meta',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: 'AVGO',
    yahooSymbol: 'AVGO',
    label: 'Broadcom',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: 'TSLA',
    yahooSymbol: 'TSLA',
    label: 'Tesla',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: 'SAP',
    yahooSymbol: 'SAP',
    label: 'SAP',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '09:00', close: '17:30', days: [1,2,3,4,5] }
  },
  {
    symbol: 'GC=F',
    yahooSymbol: 'GC%3DF',
    label: 'Gold',
    category: 'commodity',
    tradingHours: { timezone: 'Europe/Berlin', open: '01:00', close: '23:59', days: [1,2,3,4,5] }
  },
  {
    symbol: 'SI=F',
    yahooSymbol: 'SI%3DF',
    label: 'Silber',
    category: 'commodity',
    tradingHours: { timezone: 'Europe/Berlin', open: '01:00', close: '23:59', days: [1,2,3,4,5] }
  },
  {
    symbol: 'CL=F',
    yahooSymbol: 'CL%3DF',
    label: 'Öl (WTI)',
    category: 'commodity',
    tradingHours: { timezone: 'Europe/Berlin', open: '01:00', close: '23:59', days: [1,2,3,4,5] }
  },
  {
    symbol: 'EURUSD=X',
    yahooSymbol: 'EURUSD%3DX',
    label: 'EUR/USD',
    category: 'forex',
    tradingHours: { timezone: 'Europe/Berlin', open: '01:00', close: '23:59', days: [1,2,3,4,5] }
  },
]

export async function finnhubQuote(symbol: string): Promise<number | null> {
  try {
    const asset = FINANCE_ASSETS.find(a => a.symbol === symbol)
    const yahooSym = asset ? asset.yahooSymbol : encodeURIComponent(symbol)

    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1m&range=1d`,
      {
        cache: 'no-store',
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
    if (!price || price === 0) return null
    return price as number
  } catch {
    return null
  }
}

export function getBerlinTime(): Date {
  const now = new Date()
  return new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }))
}

export function isMarketOpen(asset: FinanceAsset): boolean {
  const berlin = getBerlinTime()
  const day = berlin.getDay()
  const currentMinutes = berlin.getHours() * 60 + berlin.getMinutes()

  if (!asset.tradingHours.days.includes(day)) return false

  const [openH, openM] = asset.tradingHours.open.split(':').map(Number)
  const [closeH, closeM] = asset.tradingHours.close.split(':').map(Number)
  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes
}

export function isFriday(): boolean {
  return getBerlinTime().getDay() === 5
}

export function isMonday(): boolean {
  return getBerlinTime().getDay() === 1
}

export function getDayMarketCloseISO(asset: FinanceAsset): string {
  const berlin = getBerlinTime()
  const [closeH, closeM] = asset.tradingHours.close.split(':').map(Number)
  berlin.setHours(closeH, closeM, 0, 0)
  return berlin.toISOString()
}

export function getWeekMarketCloseISO(asset: FinanceAsset): string {
  const berlin = getBerlinTime()
  const day = berlin.getDay()
  const daysUntilFriday = day === 5 ? 0 : (5 - day + 7) % 7
  berlin.setDate(berlin.getDate() + daysUntilFriday)
  const [closeH, closeM] = asset.tradingHours.close.split(':').map(Number)
  berlin.setHours(closeH, closeM, 0, 0)
  return berlin.toISOString()
}
