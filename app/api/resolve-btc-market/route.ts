import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(req: NextRequest) {
  const { marketId } = await req.json();
  if (!marketId) {
    return NextResponse.json({ error: 'marketId fehlt' }, { status: 400 });
  }

  const marketRes = await fetch(`${supabaseUrl}/rest/v1/markets?id=eq.${marketId}&select=*`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const markets = await marketRes.json();
  const market = markets[0];

  if (!market) return NextResponse.json({ error: 'Markt nicht gefunden' }, { status: 404 });
  if (!market.start_price) return NextResponse.json({ error: 'Kein Startpreis gespeichert' }, { status: 400 });

  const endPrice = await getBtcPrice();
  if (!endPrice) return NextResponse.json({ error: 'Endpreis konnte nicht abgerufen werden' }, { status: 500 });

  const resolution = endPrice >= market.start_price ? 'yes' : 'no';

  await fetch(`${supabaseUrl}/rest/v1/markets?id=eq.${marketId}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ end_price: endPrice }),
  });

  const resolveRes = await fetch(`${supabaseUrl}/rest/v1/rpc/resolve_market`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ market_id: marketId, resolution }),
  });

  if (!resolveRes.ok) {
    const err = await resolveRes.text();
    return NextResponse.json({ error: err }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    startPrice: market.start_price,
    endPrice,
    resolution,
    diff: endPrice - market.start_price,
  });
}
