import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const COIN_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  XRP: 'XRP',
};

async function getCoinPrice(coin: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.coinbase.com/v2/prices/${coin}-USD/spot`);
    const data = await res.json();
    return parseFloat(data.data.amount);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { coin = 'BTC' } = await req.json();
  const coinName = COIN_NAMES[coin] ?? coin;

  const startPrice = await getCoinPrice(coin);
  if (!startPrice) {
    return NextResponse.json({ error: 'Preis konnte nicht abgerufen werden' }, { status: 500 });
  }

  const now = new Date();
  const closesAt = new Date(now.getTime() + 3 * 60 * 1000); // 3 Minuten
  const startPriceFormatted = startPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const body = {
    question: `Ist der ${coinName}-Preis in 3 Minuten höher als jetzt ($${startPriceFormatted})?`,
    short_label: `${coin} $${startPriceFormatted} → Steigt?`,
    description: `Startpreis: $${startPriceFormatted}. Auflösungsquelle: Coinbase ${coin}/USD. Markt läuft bis ${closesAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr.`,
    category: 'Krypto',
    status: 'open',
    b: 100,
    q_yes: 0,
    q_no: 0,
    closes_at: closesAt.toISOString(),
    start_price: startPrice,
    is_auto: true,
    coin,
  };

  const res = await fetch(`${supabaseUrl}/rest/v1/markets`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: 500 });
  }

  const market = await res.json();
  return NextResponse.json({ success: true, market: market[0], startPrice, coin });
}
