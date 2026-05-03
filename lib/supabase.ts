const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-only helper — nur in API Routes verwenden
function getAdminHeaders() {
  return {
    apikey: supabaseServiceKey,
    Authorization: `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
  };
}

// Browser-safe helper — für lesende Zugriffe
function getAnonHeaders() {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };
}

export async function getMarkets() {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/markets?status=eq.open&select=*`,
    {
      headers: getAnonHeaders(),
      cache: 'no-store',
    }
  );
  if (!response.ok) throw new Error(`getMarkets failed: ${response.status}`);
  return response.json();
}

export async function placeBet(
  marketId: string,
  type: 'yes' | 'no',
  shares: number,
  cost: number,
  priceBefore: number,
  priceAfter: number,
  newQYes: number,
  newQNo: number,
  userId: string,
  _token: string
) {
  const tradeResponse = await fetch(`${supabaseUrl}/rest/v1/trades`, {
    method: 'POST',
    headers: {
      ...getAdminHeaders(),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      market_id: marketId,
      type: type === 'yes' ? 'buy_yes' : 'buy_no',
      shares,
      cost,
      price_before: priceBefore,
      price_after: priceAfter,
      user_id: userId,
    }),
  });

  if (!tradeResponse.ok) {
    const errorText = await tradeResponse.text();
    return { error: errorText, status: tradeResponse.status };
  }

  await fetch(`${supabaseUrl}/rest/v1/markets?id=eq.${marketId}`, {
    method: 'PATCH',
    headers: {
      ...getAdminHeaders(),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ q_yes: newQYes, q_no: newQNo }),
  });

  const userResponse = await fetch(
    `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=balance`,
    { headers: getAdminHeaders() }
  );
  const userData = await userResponse.json();
  const currentBalance = userData[0]?.balance || 0;
  const newBalance = currentBalance - cost;

  await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      ...getAdminHeaders(),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ balance: newBalance }),
  });

  return { success: true, newBalance };
}
