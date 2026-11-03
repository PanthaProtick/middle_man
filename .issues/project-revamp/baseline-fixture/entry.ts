import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../../../frontend/src/App';
import '../../../frontend/src/index.css';
import { account, orders, publicOrder, receipt, timestamp } from './data';
import { baseReview } from '../../../frontend/src/features/seller/courierPostSubmissionTestData';
import { extendedApi } from './extended-api';
import { Specimens } from './specimens';
import { SellerSession } from '../../../frontend/src/features/seller/SellerSession';

const params = new URLSearchParams(location.search);
const scenario = params.get('case') ?? 'seller';
localStorage.setItem('middleman.locale', params.get('lang') === 'bn' ? 'bn' : 'en');
if (params.has('fallback')) {
  const style = document.createElement('style');
  style.textContent = '* { font-family: system-ui, sans-serif !important; }';
  document.head.append(style);
}
const empty = scenario === 'empty';
const json = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));
const failure = (code: string, status = 503) => json({ error: { code, message: 'Synthetic baseline failure' } }, status);
const assetFetch = window.fetch.bind(window);
const extended = extendedApi(scenario, params.get('fault') ?? '');

// All application fetches terminate here. Known specimen writes stay in memory;
// unexpected reads and writes fail closed.
// No credentials, backend, Clerk, provider, database or project .env is involved.
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.origin);
  const path = url.pathname;
  const method = init?.method ?? 'GET';
  if (url.origin === location.origin && !path.startsWith('/api/') && method === 'GET') return assetFetch(input, init);
  console.info('BASELINE_REQUEST', method, path);
  const response = extended(url, init);
  if (response) return response;
  if (method !== 'GET') return failure('BASELINE_READ_ONLY', 405);
  if (path.endsWith('/health')) return json({ status: 'healthy', project_name: 'Synthetic baseline', environment: 'standby', database_configured: false, gemini_configured: false, clerk_configured: false });
  if (scenario === 'loading') return new Promise<Response>(() => {});
  if (scenario === 'error' || scenario === 'buyer-error') return failure('SERVICE_UNAVAILABLE');
  if (path === '/api/seller/shop') return json({ setup_needed: scenario === 'setup', shop: scenario === 'setup' ? null : { id: account.shop_id, owner_id: 'synthetic-owner', display_name: publicOrder.shop_display_name, created_at: timestamp, updated_at: timestamp } });
  if (path === '/api/seller/payment-accounts') return json(scenario === 'noaccounts' ? [] : [account]);
  if (path === '/api/seller/orders') return json({ items: empty ? [] : orders, next_cursor: null });
  if (path.startsWith('/api/seller/orders/') && !path.slice('/api/seller/orders/'.length).includes('/')) return json(orders.find(order => path.endsWith(order.id)) ?? orders[0]);
  if (path === '/api/seller/transactions') return json({ items: empty ? [] : [receipt], next_cursor: null });
  if (path === '/api/seller/unseen-entries') return json({ captured_at: timestamp, orders: 0, payments: 0, accounts: 0 });
  if (path === '/api/seller/metrics/today') return json({ date: '2026-11-02', timezone: 'Asia/Dhaka', orders: empty ? 0 : 3, confirmed: empty ? 0 : 1, awaiting: empty ? 0 : 1, pending: empty ? 0 : 1, payments: empty ? 0 : 1, staged_for_delivery: empty ? 0 : 1 });
  if (path === '/api/seller/courier/pathao/production') return json({ environment: 'production', version: 0, status: 'disconnected', simulated: false, merchant_hint: null, default_store_id: null, default_delivery_type: null, production_booking_enabled: false });
  if (path === '/api/seller/retention/status') return json({ shop_id: account.shop_id, checked_at: timestamp, counts: { sms_active: 0, sms_purged: 0 }, overdue_count: 0, failed_count: 0, overdue_items: [], last_cleanup_at: null });
  if (path === '/api/seller/retention/structured') return json({ checked_at: timestamp, overdue: 0, failed: 0, removed: 0, standby: true });
  if (path.endsWith('/courier-draft')) return json({ order_id: orders[2].id, status: 'local_proposal',
    version: 2, recipient_name: 'Synthetic buyer / পরীক্ষামূলক ক্রেতা', contact_number: '01900000000',
    address: 'Synthetic house, road and delivery directions / পরীক্ষামূলক ঠিকানা', remaining_cod_minor: 200000,
    parcel_weight_grams: 1200, parcel_quantity: 2, missing_parcel_fields: [], blockers: [] });
  if (path.endsWith('/courier-review')) return json({ ...baseReview,
    delivery_mismatch: null,
    draft: { ...baseReview.draft, recipient_name: 'Synthetic buyer / পরীক্ষামূলক ক্রেতা',
      contact_number: '01900000000', address: 'Synthetic delivery address', remaining_cod_minor: 200000 },
    latest_attempt: scenario === 'courier-unknown' ? { ...baseReview.latest_attempt,
      order_id: orders[2].id, status: 'unknown', consignment_id: null, error_code: 'TIMEOUT',
      error_message: 'Synthetic lost provider response', booking_snapshot: {
        ...baseReview.latest_attempt?.booking_snapshot, order_id: orders[2].id, remaining_cod_minor: 200000,
        amount_to_collect_bdt: 2000, recipient_name: 'Synthetic buyer', recipient_phone: '01900000000',
        recipient_address: 'Synthetic delivery address' } } : null });
  if (path.endsWith('/courier-review/locations')) return json({ condition: 'resolved', environment: 'offline',
    simulated: true, choices: [{ id: url.searchParams.has('zone_id') ? 3 : url.searchParams.has('city_id') ? 2 : 1,
      name: 'Synthetic destination' }] });
  if (path === '/api/public/orders/synthetic/pathao-locations') return json({ condition: 'disconnected', environment: 'production', simulated: false, choices: [] });
  if (path === '/api/public/orders/synthetic') return json({ ...publicOrder, lifecycle: scenario === 'buyer-pending' ? 'pending' : scenario === 'buyer-confirmed' ? 'confirmed' : scenario === 'buyer-expired' ? 'expired' : 'awaiting_buyer' });
  console.error('BASELINE_UNHANDLED', method, path);
  return failure('BASELINE_UNHANDLED', 501);
};

const buyer = scenario.startsWith('buyer');
const node = React.createElement<NonNullable<Parameters<typeof App>[0]>>(App,
  { token: buyer || scenario === 'signedout' ? undefined : 'synthetic-baseline-token' });
createRoot(document.getElementById('root')!).render(scenario.startsWith('specimen-')
  ? React.createElement(Specimens, { scenario }) : scenario.startsWith('session-')
    ? React.createElement(SellerSession) : node);
