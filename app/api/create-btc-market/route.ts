import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getBtcPrice(): Promise<number | null> {
  try {
    const res = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
    const data = await res.json();
    return parseFloat(data.data.amount);
  } catch {
    return null;
  }
}

export async function POST() {
  const startPrice = await getBtcPrice();
  if (!startPrice) {
    return NextResponse.json({ error: 'Preis konnte nicht abgerufen werden' }, { status: 500 });
  }

  const now = new Date();
  const closesAt = new Date(now.getTime() + 15 * 60 * 1000);
  const startPriceFormatted = startPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const body = {
    question: `Ist der Bitcoin-Preis in 15 Minuten höher als jetzt ($${startPriceFormatted})?`,
    short_label: `BTC $${startPriceFormatted} → Steigt?`,
    description: `Startpreis: $${startPriceFormatted}. Auflösungsquelle: Coinbase BTC/USD. Markt läuft bis ${closesAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr.`,
    category: 'Krypto',
    status: 'open',
    b: 100,
    q_yes: 0,
    q_no: 0,
    closes_at: closesAt.toISOString(),
    start_price: startPrice,
    is_auto: true,
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
  return NextResponse.json({ success: true, market: market[0], startPrice });
}
