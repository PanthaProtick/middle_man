import { useEffect, useRef, useState } from 'react';
import { requestJson } from './api';
import type { CourierAttempt, Review } from './courierReviewTypes';

type ReconciliationAction = NonNullable<CourierAttempt['resolution_action']>;

interface ReconciliationPayload {
  attempt_id: string;
  expected_version: number;
  action: ReconciliationAction;
  environment?: CourierAttempt['environment'];
  consignment_id?: string;
  merchant_order_id?: string;
}

export function CourierReconciliation({ orderId, token, attempt, onResolved }: {
  orderId: string;
  token: string;
  attempt: CourierAttempt;
  onResolved: (review: Review) => void;
}) {
  const mounted = useRef(true);
  const retryKeys = useRef(new Map<string, string>());
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [consignmentId, setConsignmentId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<ReconciliationAction>();
  const [error, setError] = useState<string>();

  const send = async (action: ReconciliationAction) => {
    if (busy) return;
    setBusy(action);
    setError(undefined);
    const common = {
      attempt_id: attempt.id,
      expected_version: attempt.resolution_version,
      action,
    };
    const body: ReconciliationPayload = action === 'attach_existing'
      ? {
        ...common,
        environment: attempt.environment,
        consignment_id: consignmentId.trim(),
        merchant_order_id: orderId,
      }
      : common;
    try {
      const serialized = JSON.stringify(body);
      const key = retryKeys.current.get(serialized) ?? `reconcile-${crypto.randomUUID()}`;
      retryKeys.current.set(serialized, key);
      const review = await requestJson<Review>(
        `/api/seller/orders/${orderId}/courier-reconciliation`,
        { method: 'POST', body: serialized },
        token,
        key,
      );
      if (mounted.current) onResolved(review);
    } catch (err: unknown) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message
          : 'Reconciliation could not be validated. The attempt remains protected.');
      }
    } finally {
      if (mounted.current) setBusy(undefined);
    }
  };

  return <section className="courier-reconciliation" aria-label="Reconcile unknown booking outcome">
    <p><strong>Check Pathao before recording a resolution.</strong> An empty or reloaded merchant panel,
      a timeout, or the absence of a local attempt is not proof by itself.</p>
    {error && <p role="alert">{error}</p>}
    <fieldset disabled={Boolean(busy)}>
      <legend>Attach an existing booking</legend>
      <p>Account environment: {attempt.environment}</p>
      <p>Merchant order reference: <code>{orderId}</code></p>
      <label>Consignment ID
        <input name="consignmentId" value={consignmentId}
          onChange={event => setConsignmentId(event.target.value)} />
      </label>
      <button type="button" data-attach
        disabled={Boolean(busy) || !consignmentId.trim()}
        onClick={() => void send('attach_existing')}>Attach existing booking</button>
    </fieldset>
    <fieldset disabled={Boolean(busy)}>
      <legend>Confirm no booking was created</legend>
      <label>
        <input type="checkbox" name="confirmedNoncreation" checked={confirmed}
          onChange={event => setConfirmed(event.target.checked)} />
        I checked the Pathao merchant panel for this account and confirmed no consignment exists for this order.
      </label>
      <button type="button" data-noncreation disabled={Boolean(busy) || !confirmed}
        onClick={() => void send('confirm_noncreation')}>Record confirmed noncreation</button>
    </fieldset>
    {busy && <p role="status">Recording reconciliation…</p>}
  </section>;
}
