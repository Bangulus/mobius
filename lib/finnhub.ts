const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY!

export type FinanceAsset = {
  symbol: string
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
    label: 'DAX',
    category: 'index',
    tradingHours: { timezone: 'Europe/Berlin', open: '09:00', close: '17:30', days: [1,2,3,4,5] }
  },
  {
    symbol: '^GSPC',
    label: 'S&P 500',
    category: 'index',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: '^NDX',
    label: 'NASDAQ 100',
    category: 'index',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: '^STOXX50E',
    label: 'Euro Stoxx 50',
    category: 'index',
    tradingHours: { timezone: 'Europe/Berlin', open: '09:00', close: '17:30', days: [1,2,3,4,5] }
  },
  {
    symbol: 'NVDA',
    label: 'NVIDIA',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: 'AAPL',
    label: 'Apple',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: 'MSFT',
    label: 'Microsoft',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: 'GOOGL',
    label: 'Alphabet',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: 'AMZN',
    label: 'Amazon',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: 'META',
    label: 'Meta',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: 'AVGO',
    label: 'Broadcom',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: 'TSLA',
    label: 'Tesla',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '15:30', close: '22:00', days: [1,2,3,4,5] }
  },
  {
    symbol: 'SAP',
    label: 'SAP',
    category: 'stock',
    tradingHours: { timezone: 'Europe/Berlin', open: '09:00', close: '17:30', days: [1,2,3,4,5] }
  },
  {
    symbol: 'OANDA:XAU_USD',
    label: 'Gold',
    category: 'commodity',
    tradingHours: { timezone: 'Europe/Berlin', open: '01:00', close: '23:59', days: [1,2,3,4,5] }
  },
  {
    symbol: 'OANDA:XAG_USD',
    label: 'Silber',
    category: 'commodity',
    tradingHours: { timezone: 'Europe/Berlin', open: '01:00', close: '23:59', days: [1,2,3,4,5] }
  },
  {
    symbol: 'OANDA:WTI_USD',
    label: 'Öl (WTI)',
    category: 'commodity',
    tradingHours: { timezone: 'Europe/Berlin', open: '01:00', close: '23:59', days: [1,2,3,4,5] }
  },
  {
    symbol: 'OANDA:EUR_USD',
    label: 'EUR/USD',
    category: 'forex',
    tradingHours: { timezone: 'Europe/Berlin', open: '01:00', close: '23:59', days: [1,2,3,4,5] }
  },
]

export async function finnhubQuote(symbol: string): Promise<number | null> {
  try {
    const encoded = encodeURIComponent(symbol)
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encoded}&token=${FINNHUB_API_KEY}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data.c || data.c === 0) return null
    return data.c as number
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
