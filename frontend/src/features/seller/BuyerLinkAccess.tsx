import { useRef, useState } from 'react';
import { requestJson, SellerApiError } from './api';
import type { SellerOrder } from './types';

interface Props {
  order: SellerOrder;
  token: string;
  onUpdated: (order: SellerOrder) => void;
}

interface AccessRequest { expected_version: number }
type Action = 'revoke' | 'reissue';

export function BuyerLinkAccess({ order, token, onUpdated }: Props) {
  const operation = useRef<{ key: string; payload: AccessRequest; action: Action } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);

  async function changeAccess(action: Action) {
    if (busy || (operation.current && operation.current.action !== action)) return;
    operation.current ??= { key: crypto.randomUUID(), payload: { expected_version: order.version }, action };
    setPendingAction(action);
    setBusy(true); setError('');
    try {
      const fresh = await requestJson<SellerOrder>(`/api/seller/orders/${order.id}/${action}-link`, {
        method: 'POST', body: JSON.stringify(operation.current.payload),
      }, token, operation.current.key);
      operation.current = null;
      setPendingAction(null);
      onUpdated(fresh);
    } catch (cause: unknown) {
      const conflict = cause instanceof SellerApiError && cause.status === 409;
      setStale(conflict);
      setError(conflict ? 'Order changed. Close and reopen its details before changing access.' :
        `${action === 'revoke' ? 'Revocation' : 'Reissue'} is unconfirmed. Retry to resolve the outcome.`);
    } finally { setBusy(false); }
  }

  const reissuable = !['expired', 'cancelled'].includes(order.lifecycle) && !order.replaced_by_order_id;
  return <section aria-label="Buyer link access">
    {order.buyer_link_revoked_at && <p role="status">Buyer link revoked. Seller access remains available.</p>}
    <p>Revoking blocks public access to this link. The order and its payment stay unchanged.</p>
    {reissuable && <p>Reissue permanently disables previous links. The original deadline and submission state stay unchanged.</p>}
    {error && <p role="alert">{error}</p>}
    {!order.buyer_link_revoked_at && <button className="btn btn-secondary"
      disabled={busy || stale || pendingAction === 'reissue'} onClick={() => void changeAccess('revoke')}>
      {busy && pendingAction === 'revoke' ? 'Revoking…' : error && pendingAction === 'revoke' ? 'Retry revocation' : 'Revoke buyer link'}
    </button>}
    {reissuable && <button className="btn btn-secondary"
      disabled={busy || stale || pendingAction === 'revoke'} onClick={() => void changeAccess('reissue')}>
      {busy && pendingAction === 'reissue' ? 'Reissuing…' : error && pendingAction === 'reissue' ? 'Retry reissue' : 'Reissue buyer link'}
    </button>}
  </section>;
}
