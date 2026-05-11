import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const host = request.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const base = `${protocol}://${host}`

  const results: Record<string, unknown> = {}

  // --- CRYPTO ---
  try {
    const cryptoCreate = await fetch(`${base}/api/create-crypto-market`, {
      method: 'POST',
      cache: 'no-store',
    })
    results.cryptoCreate = await cryptoCreate.json()
  } catch (e) {
    results.cryptoCreateError = String(e)
  }

  try {
    const cryptoResolve = await fetch(`${base}/api/resolve-crypto-market`, {
      method: 'POST',
      cache: 'no-store',
    })
    results.cryptoResolve = await cryptoResolve.json()
  } catch (e) {
    results.cryptoResolveError = String(e)
  }

  // --- FINANCE ---
  try {
    const financeCreate = await fetch(`${base}/api/create-finance-market`, {
      method: 'POST',
      cache: 'no-store',
    })
    results.financeCreate = await financeCreate.json()
  } catch (e) {
    results.financeCreateError = String(e)
  }

  try {
    const financeResolve = await fetch(`${base}/api/resolve-finance-market`, {
      method: 'POST',
      cache: 'no-store',
    })
    results.financeResolve = await financeResolve.json()
  } catch (e) {
    results.financeResolveError = String(e)
  }

  // --- SOCCER ---
  try {
    const soccerCreate = await fetch(`${base}/api/create-soccer-market`, {
      method: 'GET',
      cache: 'no-store',
    })
    results.soccerCreate = await soccerCreate.json()
  } catch (e) {
    results.soccerCreateError = String(e)
  }

  try {
    const soccerResolve = await fetch(`${base}/api/resolve-soccer-market`, {
      method: 'GET',
      cache: 'no-store',
    })
    results.soccerResolve = await soccerResolve.json()
  } catch (e) {
    results.soccerResolveError = String(e)
  }

  return NextResponse.json({ ok: true, results })
}
