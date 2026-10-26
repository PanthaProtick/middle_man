import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { CourierReconciliation } from './CourierReconciliation';
import { CourierReview } from './CourierReview';
import type { CourierAttempt, Review } from './courierReviewTypes';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

const attempt: CourierAttempt = {
  id: 'attempt-unknown', order_id: 'order-1', attempt_number: 1, status: 'unknown',
  environment: 'offline', simulated: true, reviewed_token: 'a'.repeat(64), correlation_id: 'order-1-1',
  consignment_id: null, booking_snapshot: null, error_code: 'COURIER_OUTCOME_UNKNOWN',
  error_message: 'Courier submission encountered an unexpected provider error.',
  resolution_version: 0, resolution_action: null, resolved_at: null, created_at: '', updated_at: '',
};

const review: Review = {
  token: 'a'.repeat(64), reviewed: true, submission_enabled: false, blockers: [],
  choices: { environment: 'offline', store_id: 7, delivery_type: 48, location: { city_id: 1, zone_id: 10, area_id: 100 } },
  connection: {
    environment: 'offline', status: 'connected', version: 1, merchant_hint: 'Simulated merchant',
    simulated: true, production_booking_enabled: false, default_store_id: 7, default_delivery_type: 48,
  },
  stores: [{ id: 7, name: 'My pickup store' }], location: { city_name: 'Dhaka', zone_name: 'Central', area_name: 'Covered' },
  draft: { version: 1, recipient_name: 'Current Buyer', contact_number: '01711111111', address: 'Current address',
    parcel_weight_grams: 1500, parcel_quantity: 2, remaining_cod_minor: 1000000 },
  latest_attempt: attempt,
};

function setValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function render(node: ReactElement) {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(node));
  return { host, root };
}

it('attaches a verified existing consignment with attempt version evidence', async () => {
  const recovered = {
    ...review,
    latest_attempt: { ...attempt, status: 'success' as const, consignment_id: 'SIM-PATHAO-RECOVERED',
      error_code: null, resolution_version: 1, resolution_action: 'attach_existing' as const, resolved_at: '2026-10-27T00:00:00Z' },
  };
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(recovered)));
  const onResolved = vi.fn();
  const { host, root } = await render(
    <CourierReconciliation orderId="order-1" token="seller" attempt={attempt} onResolved={onResolved} />,
  );
  await act(async () => setValue(host.querySelector<HTMLInputElement>('input[name="consignmentId"]')!, 'SIM-PATHAO-RECOVERED'));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-attach]')!.click());

  const call = fetcher.mock.calls[0];
  expect(String(call[0])).toBe('/api/seller/orders/order-1/courier-reconciliation');
  expect(new Headers(call[1]?.headers).get('Idempotency-Key')).toMatch(/^reconcile-/);
  expect(JSON.parse(String(call[1]?.body))).toEqual({
    attempt_id: attempt.id, expected_version: 0, action: 'attach_existing', environment: 'offline',
    consignment_id: 'SIM-PATHAO-RECOVERED', merchant_order_id: 'order-1',
  });
  expect(onResolved).toHaveBeenCalledWith(recovered);
  await act(async () => root.unmount());
});

it('requires an explicit confirmation before recording noncreation', async () => {
  const resolved = {
    ...review,
    latest_attempt: { ...attempt, status: 'failed' as const, error_code: 'CONFIRMED_NONCREATION',
      resolution_version: 1, resolution_action: 'confirm_noncreation' as const, resolved_at: '2026-10-27T00:00:00Z' },
  };
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(resolved)));
  const onResolved = vi.fn();
  const { host, root } = await render(
    <CourierReconciliation orderId="order-1" token="seller" attempt={attempt} onResolved={onResolved} />,
  );
  const button = host.querySelector<HTMLButtonElement>('[data-noncreation]')!;
  expect(button.disabled).toBe(true);
  await act(async () => host.querySelector<HTMLInputElement>('input[name="confirmedNoncreation"]')!.click());
  expect(button.disabled).toBe(false);
  await act(async () => button.click());

  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({
    attempt_id: attempt.id, expected_version: 0, action: 'confirm_noncreation',
  });
  expect(onResolved).toHaveBeenCalledWith(resolved);
  await act(async () => root.unmount());
});

it('keeps the unknown attempt protected when evidence is rejected', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(
    JSON.stringify({ error: { code: 'EVIDENCE_UNAVAILABLE', message: 'The consignment could not be verified.' } }),
    { status: 422 },
  ));
  const onResolved = vi.fn();
  const { host, root } = await render(
    <CourierReconciliation orderId="order-1" token="seller" attempt={attempt} onResolved={onResolved} />,
  );
  await act(async () => setValue(host.querySelector<HTMLInputElement>('input[name="consignmentId"]')!, 'SIM-PATHAO-WRONG'));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-attach]')!.click());

  expect(host.querySelector('[role="alert"]')?.textContent).toContain('could not be verified');
  expect(onResolved).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});

it('suppresses duplicate reconciliation clicks while a resolution is in flight', async () => {
  let resolveResponse: (response: Response) => void = () => {};
  const pending = new Promise<Response>(resolve => { resolveResponse = resolve; });
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => pending);
  const onResolved = vi.fn();
  const { host, root } = await render(
    <CourierReconciliation orderId="order-1" token="seller" attempt={attempt} onResolved={onResolved} />,
  );
  await act(async () => host.querySelector<HTMLInputElement>('input[name="confirmedNoncreation"]')!.click());
  const button = host.querySelector<HTMLButtonElement>('[data-noncreation]')!;
  await act(async () => button.click());
  await act(async () => button.click());
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => resolveResponse(new Response(JSON.stringify(review))));
  expect(onResolved).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});

it('offers reconciliation from the review and shows the recovered booking', async () => {
  const recovered = {
    ...review,
    latest_attempt: { ...attempt, status: 'success' as const, consignment_id: 'SIM-PATHAO-RECOVERED',
      error_code: null, resolution_version: 1, resolution_action: 'attach_existing' as const, resolved_at: '2026-10-27T00:00:00Z' },
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (String(url).includes('/courier-reconciliation')) return new Response(JSON.stringify(recovered));
    if (String(url).includes('/locations?')) return new Response(JSON.stringify({ choices: [] }));
    return new Response(JSON.stringify(review));
  });
  const { host, root } = await render(<CourierReview orderId="order-1" token="seller" />);
  expect(host.textContent).toContain('Booking outcome unknown');
  await act(async () => setValue(host.querySelector<HTMLInputElement>('input[name="consignmentId"]')!, 'SIM-PATHAO-RECOVERED'));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-attach]')!.click());

  expect(host.textContent).toContain('Existing booking attached');
  expect(host.textContent).toContain('SIM-PATHAO-RECOVERED');
  expect(host.textContent).toContain('reviewed snapshot are preserved');
  await act(async () => root.unmount());
});
