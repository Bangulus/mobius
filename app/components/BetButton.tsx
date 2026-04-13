'use client';

import { useState } from 'react';
import { placeBet } from '../../lib/supabase';

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
  const [loading, setLoading] = useState(false);
  const [qYes, setQYes] = useState(currentQYes);
  const [qNo, setQNo] = useState(currentQNo);
  const [result, setResult] = useState('');

  function calcProb(qY: number, qN: number) {
    const expYes = Math.exp(qY / b);
    const expNo = Math.exp(qN / b);
    return expYes / (expYes + expNo);
  }

  const prob = calcProb(qYes, qNo);
  const percentage = Math.round(prob * 100);

  async function bet(type: 'yes' | 'no') {
    setLoading(true);
    setResult('');
    const shares = 10;
    const priceBefore = prob;
    const newQYes = type === 'yes' ? qYes + shares : qYes;
    const newQNo = type === 'no' ? qNo + shares : qNo;
    const priceAfter = calcProb(newQYes, newQNo);
    const cost = shares * ((priceBefore + priceAfter) / 2);

    if (type === 'yes') setQYes((q) => q + shares);
    else setQNo((q) => q + shares);

    const res = await placeBet(
      marketId,
      type,
      shares,
      cost,
      priceBefore,
      priceAfter,
      newQYes,
      newQNo,
      userId,
      token
    );

    if (res.success && res.newBalance !== undefined) {
      onBalanceUpdate(res.newBalance);
    }

    setResult(res.error ? `Fehler: ${res.error}` : '✓');
    setLoading(false);
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <div
        style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
        }}
      >
        {percentage}%
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          onClick={() => bet('yes')}
          disabled={loading}
          style={{
            background: '#16a34a',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1.5rem',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
          }}
        >
          {loading ? '...' : 'YES'}
        </button>
        <button
          onClick={() => bet('no')}
          disabled={loading}
          style={{
            background: '#dc2626',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1.5rem',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
          }}
        >
          {loading ? '...' : 'NO'}
        </button>
        {result && (
          <span
            style={{
              fontSize: '0.85rem',
              color: result.startsWith('Fehler') ? 'red' : '#16a34a',
            }}
          >
            {result}
          </span>
        )}
      </div>
    </div>
  );
}
