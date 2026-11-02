import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { CourierWorkspace } from './CourierWorkspace';
import { CourierDeliveryStages } from './CourierDeliveryStages';
import { CourierReview } from './CourierReview';
import { baseReview } from './courierPostSubmissionTestData';
import type { Review } from './courierReviewTypes';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

const ready: Review = { ...baseReview, latest_attempt: null, delivery_mismatch: null,
  reviewed: true, submission_enabled: true, blockers: [] };

function hostRoot() {
  const host = document.createElement('div'); document.body.append(host);
  return { host, root: createRoot(host) };
}

function guidance(host: HTMLElement) {
  return host.querySelector('[data-next-action]')!.textContent;
}

function mockRequests() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async url => new Response(JSON.stringify(
    String(url).endsWith('/courier-draft') ? {
      ...ready.draft, order_id: 'order-1', status: 'local_proposal', blockers: [], missing_parcel_fields: [],
    } : String(url).includes('/locations?') ? { choices: [] } : ready,
  )));
}

it('invalidates readiness while choices are edited, saved, and rejected as stale', async () => {
  const fetch = mockRequests();
  const { host, root } = hostRoot();
  await act(async () => root.render(<CourierWorkspace orderId="order-1" token="seller" />));
  expect(guidance(host)).toContain('Ready to submit');
  const environment = host.querySelector<HTMLSelectElement>('select')!;
  await act(async () => {
    environment.value = 'production'; environment.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(guidance(host)).toContain('Save changes before reviewing.');
  expect(host.querySelector('[data-submit]')).toBeNull();
  let rejectSave!: (error: Error) => void;
  fetch.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSave = reject; }));
  await act(async () => Array.from(host.querySelectorAll('button'))
    .find(button => button.textContent === 'Save delivery choices')!.click());
  expect(guidance(host)).toContain('Wait for the current result.');
  await act(async () => rejectSave(new Error('Stale review')));
  expect(guidance(host)).toContain('Review unavailable. Reload current details.');
  expect(host.querySelector('[data-submit]')).toBeNull();
  await act(async () => root.unmount());
});

it('clears old readiness when order or session identity changes and reload fails', async () => {
  const fetch = mockRequests();
  const { host, root } = hostRoot();
  await act(async () => root.render(<CourierWorkspace orderId="order-1" token="seller" />));
  expect(guidance(host)).toContain('Ready to submit');
  let rejectReview!: (error: Error) => void;
  fetch.mockImplementation(url => String(url).endsWith('/courier-review')
    ? new Promise((_resolve, reject) => { rejectReview = reject; })
    : Promise.resolve(new Response(JSON.stringify({ ...ready.draft, blockers: [], missing_parcel_fields: [] }))));
  await act(async () => root.render(<CourierWorkspace orderId="order-2" token="new-session" />));
  expect(guidance(host)).toContain('Waiting for details');
  expect(host.querySelector('[data-submit]')).toBeNull();
  await act(async () => rejectReview(new Error('Offline')));
  expect(guidance(host)).toContain('Review unavailable. Reload current details.');
  await act(async () => root.unmount());
});

it('shows pending guidance during submission and recovery after its unknown result', async () => {
  const fetch = mockRequests();
  const { host, root } = hostRoot();
  await act(async () => root.render(<CourierWorkspace orderId="order-1" token="seller" />));
  let resolveSubmit!: (response: Response) => void;
  fetch.mockImplementationOnce(() => new Promise(resolve => { resolveSubmit = resolve; }));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-submit]')!.click());
  expect(guidance(host)).toContain('Wait for the current result.');
  expect(host.querySelector<HTMLButtonElement>('[data-submit]')!.disabled).toBe(true);
  await act(async () => resolveSubmit(new Response(JSON.stringify({ ...ready, submission_enabled: false,
    latest_attempt: { ...baseReview.latest_attempt!, status: 'unknown', consignment_id: null },
  }))));
  expect(guidance(host)).toContain('Resolve the unknown booking outcome');
  expect(host.querySelector('[data-submit]')).toBeNull();
  await act(async () => root.unmount());
});

it('invalidates the sequence while a parcel save triggers a fresh review', async () => {
  const fetch = mockRequests();
  const { host, root } = hostRoot();
  await act(async () => root.render(<CourierReview orderId="order-1" token="seller" refresh={0}
    parcelDetails={<div>Parcel editor</div>} />));
  expect(guidance(host)).toContain('Ready to submit');
  let resolveReview!: (response: Response) => void;
  fetch.mockImplementationOnce(() => new Promise(resolve => { resolveReview = resolve; }));
  await act(async () => root.render(<CourierReview orderId="order-1" token="seller" refresh={1}
    parcelDetails={<div>Parcel editor</div>} />));
  expect(guidance(host)).toContain('Waiting for details');
  expect(host.querySelector('[data-submit]')).toBeNull();
  await act(async () => resolveReview(new Response(JSON.stringify({ ...ready, reviewed: false, submission_enabled: false }))));
  expect(guidance(host)).toContain('Ready to review.');
  await act(async () => root.unmount());
});

it('keeps unknown recovery ahead of cancellation and connection blockers', async () => {
  const { host, root } = hostRoot();
  await act(async () => root.render(<CourierDeliveryStages review={{ ...ready,
    blockers: ['ORDER_NOT_CONFIRMED', 'COURIER_CONNECTION_REQUIRED'],
    latest_attempt: { ...baseReview.latest_attempt!, status: 'unknown' },
  }} />));
  expect(guidance(host)).toMatch(/^Resolve the unknown booking outcome/);
  expect(guidance(host)).toContain('This order is no longer confirmed.');
  expect(guidance(host)).toContain('Connect your merchant account');
  await act(async () => root.unmount());
});

it('distinguishes confirmed noncreation from rejection', async () => {
  const { host, root } = hostRoot();
  await act(async () => root.render(<CourierDeliveryStages review={{ ...ready,
    latest_attempt: { ...baseReview.latest_attempt!, status: 'failed', error_code: 'CONFIRMED_NONCREATION' },
  }} />));
  expect(host.querySelector('.courier-status-chip')!.textContent).toBe('Confirmed noncreation recorded.');
  expect(host.textContent).not.toContain('Rejected');
  await act(async () => root.unmount());
});
