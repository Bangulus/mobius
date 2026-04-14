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
  const [einsatz, setEinsatz] = useState(10);

  function calcProb(qY: number, qN: number) {
    const expYes = Math.exp(qY / b);
    const expNo = Math.exp(qN / b);
    return expYes / (expYes + expNo);
  }

  const prob = calcProb(qYes, qNo);
  const percentage = Math.round(prob * 100);

  async function bet(type: 'yes' | 'no') {
    if (einsatz <= 0) return;
    setLoading(true);
    setResult('');
    const shares = einsatz;
    const priceBefore = prob;
    const newQYes = type === 'yes' ? qYes + shares : qYes;
    const newQNo = type === 'no' ? qNo + shares : qNo;
    const priceAfter = calcProb(newQYes, newQNo);
    const cost = shares * ((priceBefore + priceAfter) / 2);

    if (type === 'yes') setQYes((q) => q + shares);
    else setQNo((q) => q + shares);

    const res = await placeBet(
      marketId, type, shares, cost, priceBefore, priceAfter, newQYes, newQNo, userId, token
    );

    if (res.success && res.newBalance !== undefined) {
      onBalanceUpdate(res.newBalance);
    }
    setResult(res.error ? '✗' : '✓');
    setLoading(false);
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
        <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: percentage > 50 ? '#16a34a' : '#dc2626', minWidth: '36px' }}>
          {percentage}%
        </span>
        <input
          type="number"
          min="1"
          value={einsatz}
          onChange={(e) => setEinsatz(Math.max(1, Number(e.target.value)))}
          style={{
            width: '60px',
            padding: '0.15rem 0.3rem',
            fontSize: '0.8rem',
            borderRadius: '4px',
            border: '1px solid #ccc',
            textAlign: 'center',
          }}
        />
        <span style={{ fontSize: '0.75rem', color: '#666' }}>D</span>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <button
          onClick={() => bet('yes')}
          disabled={loading}
          style={{ padding: '0.2rem 0.7rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
        >
          YES
        </button>
        <button
          onClick={() => bet('no')}
          disabled={loading}
          style={{ padding: '0.2rem 0.7rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
        >
          NO
        </button>
        {result && <span style={{ fontSize: '0.8rem', color: result === '✓' ? '#16a34a' : 'red' }}>{result}</span>}
      </div>
    </div>
  );
}
