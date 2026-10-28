import { useRef, useState } from 'react';
import { requestJson, SellerApiError } from './api';
import type { SellerOrder } from './types';
import './DeliveryDetails.css';
import { useLocale } from '../locale/context';
import { buyerLinkCopy } from '../locale/buyerLinkCopy';

interface Props {
  order: SellerOrder;
  token: string;
  onUpdated: (order: SellerOrder) => void;
}

interface AccessRequest { expected_version: number }
type Action = 'revoke' | 'reissue';

export function BuyerLinkAccess({ order, token, onUpdated }: Props) {
  const { locale } = useLocale();
  const text = buyerLinkCopy[locale];
  const operation = useRef<{ key: string; payload: AccessRequest; action: Action } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [error, setError] = useState<'stale' | 'revokeUnconfirmed' | 'reissueUnconfirmed' | null>(null);
  const [stale, setStale] = useState(false);

  async function changeAccess(action: Action) {
    if (busy || (operation.current && operation.current.action !== action)) return;
    operation.current ??= { key: crypto.randomUUID(), payload: { expected_version: order.version }, action };
    setPendingAction(action);
    setBusy(true); setError(null);
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
      setError(conflict ? 'stale' : action === 'revoke' ? 'revokeUnconfirmed' : 'reissueUnconfirmed');
    } finally { setBusy(false); }
  }

  const reissuable = !['expired', 'cancelled'].includes(order.lifecycle) && !order.replaced_by_order_id;
  return <section className="buyer-correction delivery-details" aria-label={text.access}>
    <h4>{text.access}</h4>
    <p className="delivery-note">{text.unchanged}</p>
    {order.buyer_link_revoked_at && <p role="status">{text.revoked}</p>}
    {error && <p role="alert">{text[error]}</p>}
    <div className="buyer-link-actions">
      {!order.buyer_link_revoked_at && <div className="buyer-link-action">
        <p id="revoke-link-description">{text.revokeDescription}</p>
        <button className="btn btn-secondary" aria-describedby="revoke-link-description"
        disabled={busy || stale || pendingAction === 'reissue'} onClick={() => void changeAccess('revoke')}>
        {busy && pendingAction === 'revoke' ? text.revoking : error && pendingAction === 'revoke' ? text.retryRevoke : text.revoke}
      </button></div>}
      {reissuable && <div className="buyer-link-action">
        <p id="reissue-link-description">{text.reissueDescription}</p>
        <button className="btn btn-secondary" aria-describedby="reissue-link-description"
        disabled={busy || stale || pendingAction === 'revoke'} onClick={() => void changeAccess('reissue')}>
        {busy && pendingAction === 'reissue' ? text.reissuing : error && pendingAction === 'reissue' ? text.retryReissue : text.reissue}
      </button></div>}
    </div>
  </section>;
}
