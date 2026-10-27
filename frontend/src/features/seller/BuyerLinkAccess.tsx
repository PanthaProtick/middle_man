import { useRef, useState } from 'react';
import { requestJson, SellerApiError } from './api';
import type { SellerOrder } from './types';
import './DeliveryDetails.css';

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
  return <section className="buyer-correction delivery-details" aria-label="Buyer link access">
    <h4>Buyer link access</h4>
    <p className="delivery-note">These actions keep the order and payment unchanged.</p>
    {order.buyer_link_revoked_at && <p role="status">Buyer link revoked. Seller access remains available.</p>}
    {error && <p role="alert">{error}</p>}
    <div className="buyer-link-actions">
      {!order.buyer_link_revoked_at && <div className="buyer-link-action">
        <p id="revoke-link-description">Block buyer access to the current link.</p>
        <button className="btn btn-secondary" aria-describedby="revoke-link-description"
        disabled={busy || stale || pendingAction === 'reissue'} onClick={() => void changeAccess('revoke')}>
        {busy && pendingAction === 'revoke' ? 'Revoking…' : error && pendingAction === 'revoke' ? 'Retry revocation' : 'Revoke buyer link'}
      </button></div>}
      {reissuable && <div className="buyer-link-action">
        <p id="reissue-link-description">Create a new link and permanently disable previous links. The deadline and submission state stay unchanged.</p>
        <button className="btn btn-secondary" aria-describedby="reissue-link-description"
        disabled={busy || stale || pendingAction === 'revoke'} onClick={() => void changeAccess('reissue')}>
        {busy && pendingAction === 'reissue' ? 'Reissuing…' : error && pendingAction === 'reissue' ? 'Retry reissue' : 'Reissue buyer link'}
      </button></div>}
    </div>
  </section>;
}
