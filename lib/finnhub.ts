// lib/finnhub.ts

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

// Berechnet den aktuellen UTC-Offset für Europe/Berlin dynamisch (+01:00 oder +02:00)
function getBerlinOffsetString(forDate: Date = new Date()): string {
  // Vergleiche UTC-Zeit mit Berliner Zeit
  const utcHour = forDate.getUTCHours()
  const utcMinute = forDate.getUTCMinutes()

  const berlinParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(forDate)

  const berlinHour = parseInt(berlinParts.find(p => p.type === 'hour')!.value)
  const berlinMinute = parseInt(berlinParts.find(p => p.type === 'minute')!.value)

  let offsetMinutes = (berlinHour * 60 + berlinMinute) - (utcHour * 60 + utcMinute)
  // Mitternacht-Überlauf abfangen
  if (offsetMinutes > 720) offsetMinutes -= 1440
  if (offsetMinutes < -720) offsetMinutes += 1440

  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absMinutes = Math.abs(offsetMinutes)
  const h = String(Math.floor(absMinutes / 60)).padStart(2, '0')
  const m = String(absMinutes % 60).padStart(2, '0')
  return `${sign}${h}:${m}`
}

// Gibt Berliner Stunde/Minute/Wochentag korrekt zurück
export function getBerlinParts(): { hours: number; minutes: number; day: number } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(now)

  const hours = parseInt(parts.find(p => p.type === 'hour')!.value)
  const minutes = parseInt(parts.find(p => p.type === 'minute')!.value)
  const weekdayStr = parts.find(p => p.type === 'weekday')!.value
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const day = weekdayMap[weekdayStr] ?? 0

  return { hours, minutes, day }
}

// Für Kompatibilität mit bestehendem Code
export function getBerlinTime(): Date {
  const now = new Date()
  return new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }))
}

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

export function isMarketOpen(asset: FinanceAsset): boolean {
  const { hours, minutes, day } = getBerlinParts()
  const currentMinutes = hours * 60 + minutes

  if (!asset.tradingHours.days.includes(day)) return false

  const [openH, openM] = asset.tradingHours.open.split(':').map(Number)
  const [closeH, closeM] = asset.tradingHours.close.split(':').map(Number)
  const openMinutes = openH * 60 + openM
  const closeMinutes = closeH * 60 + closeM

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes
}

export function isFriday(): boolean {
  return getBerlinParts().day === 5
}

export function isMonday(): boolean {
  return getBerlinParts().day === 1
}

// closes_at für Tagesmarkt — dynamischer UTC-Offset
export function getDayMarketCloseISO(asset: FinanceAsset): string {
  const [closeH, closeM] = asset.tradingHours.close.split(':').map(Number)
  const now = new Date()
  const berlinDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' }) // YYYY-MM-DD
  const offset = getBerlinOffsetString(now)
  return new Date(
    `${berlinDateStr}T${String(closeH).padStart(2, '0')}:${String(closeM).padStart(2, '0')}:00${offset}`
  ).toISOString()
}

// closes_at für Wochenmarkt (Freitag) — dynamischer UTC-Offset
export function getWeekMarketCloseISO(asset: FinanceAsset): string {
  const [closeH, closeM] = asset.tradingHours.close.split(':').map(Number)
  const now = new Date()
  const berlinDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' })
  const today = new Date(berlinDateStr)
  const day = today.getDay()
  const daysUntilFriday = day === 5 ? 0 : (5 - day + 7) % 7
  today.setDate(today.getDate() + daysUntilFriday)
  const fridayStr = today.toISOString().split('T')[0]
  const offset = getBerlinOffsetString(now)
  return new Date(
    `${fridayStr}T${String(closeH).padStart(2, '0')}:${String(closeM).padStart(2, '0')}:00${offset}`
  ).toISOString()
}
