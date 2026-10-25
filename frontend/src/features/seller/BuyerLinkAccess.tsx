import { useRef, useState } from 'react';
import { requestJson, SellerApiError } from './api';
import type { SellerOrder } from './types';

interface Props {
  order: SellerOrder;
  token: string;
  onUpdated: (order: SellerOrder) => void;
}

interface RevokeRequest { expected_version: number }

function revokeBuyerLink(orderId: string, payload: RevokeRequest, key: string, token: string): Promise<SellerOrder> {
  return requestJson(`/api/seller/orders/${orderId}/revoke-link`, {
    method: 'POST', body: JSON.stringify(payload),
  }, token, key);
}

export function BuyerLinkAccess({ order, token, onUpdated }: Props) {
  const operation = useRef<{ key: string; payload: RevokeRequest } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);

  async function revoke() {
    if (busy) return;
    operation.current ??= { key: crypto.randomUUID(), payload: { expected_version: order.version } };
    setBusy(true); setError('');
    try {
      const fresh = await revokeBuyerLink(order.id, operation.current.payload, operation.current.key, token);
      onUpdated(fresh);
    } catch (cause: unknown) {
      const conflict = cause instanceof SellerApiError && cause.status === 409;
      setStale(conflict);
      setError(conflict ? 'Order changed. Close and reopen its details before revoking.' :
        'Revocation is unconfirmed. Retry to resolve the outcome.');
    } finally { setBusy(false); }
  }

  if (order.buyer_link_revoked_at) return <p role="status">Buyer link revoked. Seller access remains available.</p>;
  return <section aria-label="Buyer link access">
    <p>Revoking blocks public access to this link. The order and its payment stay unchanged.</p>
    {error && <p role="alert">{error}</p>}
    <button className="btn btn-secondary" disabled={busy || stale} onClick={() => void revoke()}>
      {busy ? 'Revoking…' : error ? 'Retry revocation' : 'Revoke buyer link'}
    </button>
  </section>;
}
