import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { CourierReview } from './CourierReview';
import { BuyerCorrection } from './BuyerCorrection';
import { OrderOutcomes } from './OrderOutcomes';
import type { Review } from './courierReviewTypes';
import type { SellerOrder } from './types';
import { baseReview, mockOrder } from './courierPostSubmissionTestData';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

it('CourierReview displays delivery mismatch warning and original booked snapshot', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(baseReview)));
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => root.render(<CourierReview orderId="order-1" token="seller-token" />));

  expect(container.textContent).toContain('Action required in Pathao');
  expect(container.textContent).toContain('Delivery details were updated locally after courier submission');
  expect(container.textContent).toContain('Original booked details: Original Buyer · 01711111111 · Original Address 123');
  expect(container.textContent).toContain('SIM-PATHAO-12345');

  await act(async () => root.unmount());
});

it('CourierReview displays cancellation mismatch warning when order is cancelled after booking', async () => {
  const cancelledReview: Review = {
    ...baseReview,
    blockers: ['ORDER_NOT_CONFIRMED'],
    delivery_mismatch: {
      mismatch: true,
      cancelled: true,
      recipient_name_changed: false,
      contact_number_changed: false,
      address_changed: false,
      changed_fields: ['cancellation'],
      booked_snapshot: baseReview.delivery_mismatch!.booked_snapshot,
      message: 'Order was cancelled locally after courier submission. Local cancellation does not cancel the Pathao booking. Resolve or cancel the booking directly in Pathao.',
    },
  };
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(cancelledReview)));
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => root.render(<CourierReview orderId="order-1" token="seller-token" />));

  expect(container.textContent).toContain('Action required in Pathao');
  expect(container.textContent).toContain('Order was cancelled locally after courier submission');
  expect(container.textContent).toContain('Local cancellation does not cancel this existing Pathao booking');

  await act(async () => root.unmount());
});

it('BuyerCorrection distinguishes unsubmitted draft vs confirmed courier booking', async () => {
  const revision = {
    id: 'rev-1',
    revision_number: 1,
    buyer_name: 'Test Buyer',
    contact_number: '01711111111',
    address: { raw_text: 'Test Address' },
    payment_claim: { provider: 'bkash', trx_id: 'TRX1', sender_number: '01811111111', amount_minor: 100000 },
    actor: 'buyer',
    reason: null,
    created_at: '2026-10-27T00:00:00Z',
    claim_accepted_at: '2026-10-27T00:00:00Z',
  };

  const response = (data: unknown) => new Response(JSON.stringify(data));
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(response(mockOrder))
    .mockResolvedValueOnce(response({ items: [revision], next_cursor: null }));

  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  // Render with courierAttemptStatus = 'success'
  await act(async () =>
    root.render(
      <BuyerCorrection orderId="order-1" token="seller" courierAttemptStatus="success" />
    )
  );

  expect(container.textContent).toContain('Courier booking is already confirmed in Pathao');
  expect(container.textContent).toContain('Portal corrections do not update courier bookings');
  expect(container.textContent).toContain('Update courier parcels separately in Pathao');

  // Now render with unsubmitted status
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(response(mockOrder))
    .mockResolvedValueOnce(response({ items: [revision], next_cursor: null }));

  await act(async () =>
    root.render(
      <BuyerCorrection orderId="order-1" token="seller" courierAttemptStatus="unsubmitted" />
    )
  );

  expect(container.textContent).toContain('Unsubmitted courier draft');
  expect(container.textContent).toContain('Corrections refresh the delivery draft before booking submission');

  await act(async () => root.unmount());
});

it('OrderOutcomes shows courier warning when cancelling a booked order', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  // Render with courierAttemptStatus = 'success'
  await act(async () =>
    root.render(
      <OrderOutcomes
        order={mockOrder}
        token="seller"
        courierAttemptStatus="success"
        onUpdated={vi.fn()}
      />
    )
  );

  // Open cancel form
  const cancelBtn = container.querySelector<HTMLButtonElement>('button')!;
  await act(async () => {
    cancelBtn.click();
  });

  expect(container.textContent).toContain('Local cancellation does not cancel the courier booking in Pathao');
  expect(container.textContent).toContain('You must resolve or cancel the booking directly in Pathao');

  await act(async () => root.unmount());
});

it('OrderOutcomes shows draft cancellation notice when order is not yet booked', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  // Render with courierAttemptStatus = 'unsubmitted'
  await act(async () =>
    root.render(
      <OrderOutcomes
        order={mockOrder}
        token="seller"
        courierAttemptStatus="unsubmitted"
        onUpdated={vi.fn()}
      />
    )
  );

  // Open cancel form
  const cancelBtn = container.querySelector<HTMLButtonElement>('button')!;
  await act(async () => {
    cancelBtn.click();
  });

  expect(container.textContent).toContain('Cancellation prevents courier draft submission. No local courier attempt is recorded; check Pathao for bookings created elsewhere.');

  await act(async () => root.unmount());
});

it('OrderOutcomes shows courier warning when replacing a booked order', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  // Unallocated order so Replace button is visible
  const unallocatedOrder: SellerOrder = {
    ...mockOrder,
    lifecycle: 'pending',
    allocation_basis: null,
  };

  await act(async () =>
    root.render(
      <OrderOutcomes
        order={unallocatedOrder}
        token="seller"
        courierAttemptStatus="success"
        onUpdated={vi.fn()}
      />
    )
  );

  // Click Replace Order
  const replaceBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (b) => b.textContent?.includes('Replace Order')
  )!;
  await act(async () => {
    replaceBtn.click();
  });

  expect(container.textContent).toContain('Predecessor will be cancelled');
  expect(container.textContent).toContain('Local cancellation does not cancel the courier booking in Pathao');
  expect(container.textContent).toContain('You must resolve or cancel the booking directly in Pathao');

  await act(async () => root.unmount());
});

it('CourierReview calls onReviewLoaded on reconciliation resolution', async () => {
  const unknownReview: Review = {
    ...baseReview,
    latest_attempt: {
      ...baseReview.latest_attempt!,
      status: 'unknown',
      error_code: 'INTERRUPTED_IN_FLIGHT',
      error_message: 'Interrupted',
      consignment_id: null,
    },
    delivery_mismatch: null,
  };

  const onReviewLoaded = vi.fn();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(unknownReview)));

  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  await act(async () =>
    root.render(<CourierReview orderId="order-1" token="seller" onReviewLoaded={onReviewLoaded} />)
  );

  expect(onReviewLoaded).toHaveBeenCalledWith(unknownReview);

  await act(async () => root.unmount());
});

