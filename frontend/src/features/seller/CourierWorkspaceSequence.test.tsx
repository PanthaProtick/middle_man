import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { CourierWorkspace } from './CourierWorkspace';
import { baseReview } from './courierPostSubmissionTestData';
import type { Review } from './courierReviewTypes';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

const draft = {
  order_id: 'order-1', status: 'local_proposal', version: 2, recipient_name: 'Updated Buyer',
  contact_number: '01922222222', address: 'Updated Address 789', remaining_cod_minor: 500000,
  parcel_weight_grams: 1200, parcel_quantity: 2, missing_parcel_fields: [], blockers: [],
};

async function mount(review: Review) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async url => new Response(JSON.stringify(
    String(url).endsWith('/courier-draft') ? draft
      : String(url).includes('/locations?') ? { choices: [] } : review,
  )));
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<CourierWorkspace orderId="order-1" token="seller" />));
  return { host, root };
}

function step(host: HTMLElement, label: string) {
  return Array.from(host.querySelectorAll<HTMLElement>('[data-courier-sequence] li'))
    .find(item => item.textContent?.includes(label))!;
}

it('renders the five delivery stages and names the blocking review action', async () => {
  const review: Review = {
    ...baseReview, reviewed: false, submission_enabled: false, latest_attempt: null,
    delivery_mismatch: null, blockers: ['PICKUP_STORE_REQUIRED'],
    choices: { ...baseReview.choices, store_id: null, delivery_type: null, location: {} },
    connection: { ...baseReview.connection, status: 'disconnected' },
    location: { city_name: null, zone_name: null, area_name: null },
  };
  const { host, root } = await mount(review);

  expect(host.textContent).toContain('Delivery preparation');
  expect(host.textContent).toContain('Prepare this delivery');
  expect(host.querySelectorAll('[data-courier-sequence] li')).toHaveLength(5);
  expect(step(host, 'Parcel details')).toBeDefined();
  expect(step(host, 'Local draft').dataset.state).toBe('blocked');
  expect(step(host, 'Local draft').getAttribute('aria-current')).toBe('step');
  expect(host.querySelector('[data-next-action]')?.getAttribute('data-next-action')).toBe('blocked');
  expect(host.textContent).toContain('Next action blocked:');
  expect(host.textContent).toContain('Choose an active pickup store for this connection.');
  expect(host.textContent).toContain('Needs review');
  await act(async () => root.unmount());
});

it('blocks submission and points to reconciliation when the outcome is unknown', async () => {
  const review: Review = {
    ...baseReview,
    submission_enabled: false,
    delivery_mismatch: null,
    latest_attempt: {
      ...baseReview.latest_attempt!, status: 'unknown', consignment_id: null,
      error_code: 'COURIER_OUTCOME_UNKNOWN', error_message: 'Timeout',
    },
  };
  const { host, root } = await mount(review);

  expect(host.textContent).toContain('Outcome unknown');
  expect(step(host, 'Submit booking').dataset.state).toBe('blocked');
  expect(step(host, 'Booking result').dataset.state).toBe('blocked');
  expect(host.querySelector('[data-submit]')).toBeNull();
  expect(host.textContent).toContain('Resolve the unknown booking outcome before any new booking.');
  expect(host.textContent).toContain('Resolve unknown outcome');
  await act(async () => root.unmount());
});
