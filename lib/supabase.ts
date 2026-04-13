const supabaseUrl = 'https://zrujclkigcrlrvpgxrqx.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydWpjbGtpZ2NybHJ2cGd4cnF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQ0NTEsImV4cCI6MjA5MTQwMDQ1MX0.JpuZxskptogAKtw5cUR3gJOAcnh3BFh1NSvfVEtN8IQ';

export async function getMarkets() {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/markets?status=eq.open&select=*`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      cache: 'no-store',
    }
  );
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
  token: string
) {
  const authToken = token || supabaseKey;

  const tradeResponse = await fetch(`${supabaseUrl}/rest/v1/trades`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
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
      apikey: supabaseKey,
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      q_yes: newQYes,
      q_no: newQNo,
    }),
  });

  const userResponse = await fetch(
    `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=balance`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );
  const userData = await userResponse.json();
  const currentBalance = userData[0]?.balance || 0;
  const newBalance = currentBalance - cost;

  await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ balance: newBalance }),
  });

  return { success: true, newBalance };
}
