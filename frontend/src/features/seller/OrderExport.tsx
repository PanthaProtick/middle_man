import { sellerFetch } from './sessionRequest';
import { useEffect, useRef, useState } from 'react';
import { requestJson } from './api';
import type { OrderLifecycle } from './types';

interface OrderSummary {
  order_id: string;
  product: string;
  lifecycle: OrderLifecycle;
  buyer_name: string;
  contact_number: string;
  address: string;
  total_bdt: string;
  required_advance_bdt: string;
  accepted_advance_bdt: string;
  expected_cod_bdt: string;
  actual_cod_bdt: string;
  purpose: string;
}

function readable(summary: OrderSummary): string {
  return [
    `Order: ${summary.order_id}`, `Product: ${summary.product}`, `Lifecycle: ${summary.lifecycle}`,
    `Buyer: ${summary.buyer_name}`, `Contact: ${summary.contact_number}`, `Address: ${summary.address}`,
    `Fixed total: BDT ${summary.total_bdt}`, `Required advance: BDT ${summary.required_advance_bdt}`,
    `Accepted advance: ${summary.accepted_advance_bdt ? `BDT ${summary.accepted_advance_bdt}` : 'Not accepted'}`,
    `Expected COD: BDT ${summary.expected_cod_bdt}`,
    `Actual COD: ${summary.actual_cod_bdt ? `BDT ${summary.actual_cod_bdt}` : 'Not accepted'}`,
    summary.purpose,
  ].join('\n');
}

export function OrderExport({ orderId, status, token }: {
  orderId?: string; status?: string; token?: string;
}): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function run() {
    setBusy(true); setMessage(''); setFailed(false);
    try {
      if (orderId) {
        const summary = await requestJson<OrderSummary>(
          `/api/seller/orders/${encodeURIComponent(orderId)}/summary`, {}, token,
        );
        if (!active.current) return;
        await navigator.clipboard.writeText(readable(summary));
        setMessage('Summary copied.');
      } else {
        const query = status ? `?${new URLSearchParams({ status })}` : '';
        const response = await sellerFetch(`/api/seller/orders/export${query}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }, token);
        if (!response.ok) {
          const body: { error?: { message?: string } } = await response.json();
          throw new Error(body.error?.message ?? `Export failed (${response.status}).`);
        }
        if (response.headers.get('X-Export-Count') === '0') {
          setMessage('No orders match this filter.');
          return;
        }
        const blob = await response.blob();
        if (!active.current) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = 'order-summaries.csv';
        document.body.append(link); link.click(); link.remove();
        // Let the browser consume the URL before releasing the download resource.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage('CSV download started.');
      }
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : 'Copy/export unavailable. Please retry.');
    } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run()}>
          {busy ? 'Preparing…' : orderId ? 'Copy delivery summary' : 'Download filtered CSV'}
        </button>
      </div>
      <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: 1.4 }}>
        Manual delivery aid only; no courier booking, update or delivery-price calculation.
      </small>
      {message && (
        <p
          role={failed ? 'alert' : 'status'}
          style={{
            margin: '2px 0 0',
            fontSize: '0.8rem',
            color: failed ? 'var(--rose-accent)' : 'var(--emerald-accent)',
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
