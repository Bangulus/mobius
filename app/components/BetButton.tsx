'use client';

import { useRouter } from 'next/navigation';

interface Props {
  marketId: string;
  currentQYes: number;
  currentQNo: number;
  b: number;
  userId: string;
  token: string;
  onBalanceUpdate: (newBalance: number) => void;
}

export default function BetButton({
  marketId,
  currentQYes,
  currentQNo,
  b,
  userId,
  token,
  onBalanceUpdate,
}: Props) {
  const router = useRouter();

  function calcProb(qY: number, qN: number) {
    const expYes = Math.exp(qY / b);
    const expNo = Math.exp(qN / b);
    return expYes / (expYes + expNo);
  }

  const prob = calcProb(currentQYes, currentQNo);
  const percentageYes = Math.round(prob * 100);
  const percentageNo = 100 - percentageYes;

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const tokenParam = searchParams?.get('token') ? `?token=${searchParams.get('token')}&user_id=${searchParams.get('user_id')}` : '';

  function goToMarket(side: 'yes' | 'no') {
    router.push(`/markets/${marketId}${tokenParam}`);
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
      <button
        onClick={() => goToMarket('yes')}
        style={{ padding: '0.35rem 1rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
      >
        Ja {percentageYes}¢
      </button>
      <button
        onClick={() => goToMarket('no')}
        style={{ padding: '0.35rem 1rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
      >
        Nein {percentageNo}¢
      </button>
    </div>
  );
}
