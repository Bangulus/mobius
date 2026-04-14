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
  const [einsatz, setEinsatz] = useState(0);
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [expanded, setExpanded] = useState(false);

  function calcProb(qY: number, qN: number) {
    const expYes = Math.exp(qY / b);
    const expNo = Math.exp(qN / b);
    return expYes / (expYes + expNo);
  }

  const prob = calcProb(qYes, qNo);
  const percentageYes = Math.round(prob * 100);
  const percentageNo = 100 - percentageYes;

  const newQYes = side === 'yes' ? qYes + einsatz : qYes;
  const newQNo = side === 'no' ? qNo + einsatz : qNo;
  const priceAfter = calcProb(newQYes, newQNo);
  const cost = einsatz * ((prob + priceAfter) / 2);
  const gewinn = einsatz - cost;

  async function bet() {
    if (einsatz <= 0) return;
    setLoading(true);
    setResult('');
    const priceBefore = prob;

    if (side === 'yes') setQYes((q) => q + einsatz);
    else setQNo((q) => q + einsatz);

    const res = await placeBet(
      marketId, side, einsatz, cost, priceBefore, priceAfter, newQYes, newQNo, userId, token
    );

    if (res.success && res.newBalance !== undefined) {
      onBalanceUpdate(res.newBalance);
      setResult('✓');
    } else {
      setResult('✗');
    }
    setLoading(false);
    setTimeout(() => setResult(''), 2000);
  }

  if (!expanded) {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
        <button
          onClick={() => { setSide('yes'); setExpanded(true); }}
          style={{ padding: '0.35rem 1rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
        >
          Ja {percentageYes}¢
        </button>
        <button
          onClick={() => { setSide('no'); setExpanded(true); }}
          style={{ padding: '0.35rem 1rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
        >
          Nein {percentageNo}¢
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem' }}>
      {/* Ja/Nein Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setSide('yes')}
            style={{ padding: '0.4rem 1.2rem', background: side === 'yes' ? '#16a34a' : '#e5e7eb', color: side === 'yes' ? 'white' : '#555', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}
          >
            Ja {percentageYes}¢
          </button>
          <button
            onClick={() => setSide('no')}
            style={{ padding: '0.4rem 1.2rem', background: side === 'no' ? '#dc2626' : '#e5e7eb', color: side === 'no' ? 'white' : '#555', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}
          >
            Nein {percentageNo}¢
          </button>
        </div>
        <button onClick={() => setExpanded(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#aaa' }}>
          ✕
        </button>
      </div>

      {/* Betrag */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#888' }}>Betrag</span>
          <input
            type="number"
            min="0"
            value={einsatz === 0 ? '' : einsatz}
            placeholder="0"
            onChange={(e) => setEinsatz(Math.max(0, Number(e.target.value)))}
            style={{
              width: '100px',
              padding: '0.35rem 0.5rem',
              fontSize: '1.4rem',
              fontWeight: 'bold',
              borderRadius: '6px',
              border: '1px solid #ccc',
              textAlign: 'right',
              appearance: 'textfield',
              MozAppearance: 'textfield',
            } as any}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {[1, 5, 10, 50, 100].map((v) => (
            <button
              key={v}
              onClick={() => setEinsatz((e) => e + v)}
              style={{ flex: 1, padding: '0.3rem 0', background: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', color: '#333', fontWeight: '500' }}
            >
              +{v}
            </button>
          ))}
        </div>
      </div>

      {/* Um zu gewinnen */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0.65rem 0.75rem', background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        <span style={{ fontSize: '0.85rem', color: '#666' }}>💰 Um zu gewinnen</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#16a34a' }}>
            +{gewinn.toFixed(2)}
          </span>
          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#16a34a' }}>
            D
          </span>
        </div>
      </div>

      {/* Kaufen Button */}
      <button
        onClick={bet}
        disabled={loading || einsatz <= 0}
        style={{
          width: '100%',
          padding: '0.65rem',
          background: einsatz <= 0 ? '#ccc' : side === 'yes' ? '#16a34a' : '#dc2626',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: loading || einsatz <= 0 ? 'not-allowed' : 'pointer',
          fontSize: '0.95rem',
          fontWeight: 'bold',
        }}
      >
        {loading ? '...' : result === '✓' ? '✓ Trade platziert!' : `${side === 'yes' ? 'Ja' : 'Nein'} kaufen`}
      </button>
    </div>
  );
}
