import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CourierReview } from '../src/features/seller/CourierReview';
import type { CourierAttempt, Review } from '../src/features/seller/courierReviewTypes';
import '../src/index.css';

const attempt: CourierAttempt = {
  id: 'browser-attempt', order_id: 'browser-order', attempt_number: 1, status: 'unknown',
  environment: 'offline', simulated: true, reviewed_token: 'a'.repeat(64), correlation_id: 'browser-order-1',
  consignment_id: null, booking_snapshot: null, error_code: 'COURIER_OUTCOME_UNKNOWN',
  error_message: 'Synthetic interrupted response', resolution_version: 0, resolution_action: null,
  resolved_at: null, created_at: '', updated_at: '',
};
const fixture: Review = {
  token: 'a'.repeat(64), reviewed: true, submission_enabled: false, blockers: [],
  choices: { environment: 'offline', store_id: 7, delivery_type: 48,
    location: { city_id: 1, zone_id: 10, area_id: 100 } },
  connection: { environment: 'offline', status: 'connected', version: 1, merchant_hint: 'Simulated merchant',
    simulated: true, production_booking_enabled: false, default_store_id: 7, default_delivery_type: 48 },
  stores: [{ id: 7, name: 'Simulated pickup store' }],
  location: { city_name: 'Dhaka', zone_name: 'Central', area_name: 'Covered' },
  draft: { version: 1, recipient_name: 'Synthetic Buyer', contact_number: '01711111111',
    address: 'Synthetic address, Dhaka', parcel_weight_grams: 1000, parcel_quantity: 2,
    remaining_cod_minor: 1000000 }, latest_attempt: attempt,
};
let current = structuredClone(fixture);
let mode = 'success';
let release: (() => void) | undefined;
let calls: { action: string; key: string | null }[] = [];
let refreshLog = () => {};
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = String(input);
  if (!url.startsWith('/api/seller/orders/browser-order/')) return originalFetch(input, init);
  if (url.includes('/locations?')) return new Response(JSON.stringify({ choices: [] }));
  if (!url.endsWith('/courier-reconciliation')) return new Response(JSON.stringify(current));
  const body = JSON.parse(String(init?.body)) as { action: 'attach_existing' | 'confirm_noncreation' };
  calls.push({ action: body.action, key: new Headers(init?.headers).get('Idempotency-Key') });
  refreshLog();
  if (mode === 'rejected') return new Response(JSON.stringify({ error: {
    code: 'EVIDENCE_UNAVAILABLE', message: 'The consignment could not be verified. Check Pathao again.',
  } }), { status: 422 });
  if (mode === 'interrupted') throw new TypeError('Synthetic response interruption');
  if (mode === 'pending') await new Promise<void>(resolve => { release = resolve; });
  current = { ...current, latest_attempt: { ...attempt,
    status: body.action === 'attach_existing' ? 'success' : 'failed',
    consignment_id: body.action === 'attach_existing' ? 'SIM-PATHAO-RECOVERED' : null,
    resolution_action: body.action, resolution_version: 1, resolved_at: new Date().toISOString(),
    error_code: body.action === 'attach_existing' ? null : 'CONFIRMED_NONCREATION',
  } };
  return new Response(JSON.stringify(current));
};
function Harness() {
  const [revision, setRevision] = useState(0);
  const [, setLog] = useState(0);
  refreshLog = () => setLog(value => value + 1);
  return <main style={{ maxWidth: 1000, margin: '20px auto', padding: 20 }}>
    <h1>Ticket 07 browser verification</h1>
    <p>Local synthetic fixtures. Actual seller components and styles; no live account or courier calls.</p>
    <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button onClick={() => { current = structuredClone(fixture); calls = []; mode = 'success'; setRevision(value => value + 1); }}>Reset unknown</button>
      <button onClick={() => { mode = 'rejected'; }}>Reject evidence</button>
      <button onClick={() => { mode = 'interrupted'; }}>Interrupt response</button>
      <button onClick={() => { mode = 'pending'; }}>Hold response</button>
      <button onClick={() => { mode = 'success'; }}>Return success</button>
      <button onClick={() => { release?.(); }}>Complete pending response</button>
      <button onClick={() => { current = { ...structuredClone(fixture), reviewed: false, blockers: ['ORDER_NOT_CONFIRMED'] }; setRevision(value => value + 1); }}>Cancelled order</button>
    </nav>
    <pre aria-label="Synthetic request evidence" style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
      {JSON.stringify({ requests: calls.length, sameKey: calls.length > 1 ? calls.at(-1)?.key === calls.at(-2)?.key : null, calls }, null, 2)}
    </pre>
    <CourierReview key={revision} orderId="browser-order" token="synthetic-browser-session" />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
