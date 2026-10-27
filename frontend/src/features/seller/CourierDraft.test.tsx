import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { CourierDraft } from './CourierDraft';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

const proposal = {
  order_id: 'order-a', status: 'local_proposal', version: 3, recipient_name: 'Synthetic Buyer',
  contact_number: '01711111111', address: 'Synthetic Dhaka address', remaining_cod_minor: 1050000,
  parcel_weight_grams: null, parcel_quantity: null, missing_parcel_fields: ['weight', 'quantity'],
  blockers: ['PARCEL_DETAILS_REQUIRED', 'COURIER_CONNECTION_REQUIRED', 'LOCATION_METADATA_REQUIRED'],
};

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

it('shows the local proposal, accepted COD and exactly which parcel fields are missing', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(proposal)));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<CourierDraft orderId="order-a" token="seller-a" />));
  expect(host.textContent).toContain('Local courier proposal');
  expect(host.textContent).toContain('01711111111');
  expect(host.textContent).toContain('10500.00');
  expect(host.textContent).toContain('Add parcel');
  expect(host.textContent).toContain('Missing parcel fields: Weight, Quantity');
  expect(host.textContent).toContain('Optional when creating the buyer link');
  expect(host.textContent).toContain('Connect');
  expect(host.textContent).toContain('Select Pathao');
  expect(host.textContent).toContain('Payment acceptance does not independently verify receipt');
  expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer seller-a' });
  await act(async () => root.unmount());
});

it('saves parcel details with the current version and an idempotency key', async () => {
  const complete = {
    ...proposal, version: 4, parcel_weight_grams: 1500, parcel_quantity: 2,
    missing_parcel_fields: [], blockers: ['COURIER_CONNECTION_REQUIRED', 'LOCATION_METADATA_REQUIRED'],
  };
  const fetcher = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify(proposal)))
    .mockResolvedValueOnce(new Response(JSON.stringify(complete)));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<CourierDraft orderId="order-a" token="seller-a" />));
  await act(async () => {
    setInputValue(host.querySelector('input[name="parcelWeightKg"]')!, '1.5');
    setInputValue(host.querySelector('input[name="parcelQuantity"]')!, '2');
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(fetcher).toHaveBeenCalledTimes(2);
  const [url, init] = fetcher.mock.calls[1];
  expect(String(url)).toContain('/api/seller/orders/order-a/courier-draft');
  if (!init) throw new Error('Expected a PATCH request');
  expect(init.method).toBe('PATCH');
  expect(init.headers).toMatchObject({ Authorization: 'Bearer seller-a' });
  expect((init.headers as Record<string, string>)['Idempotency-Key']).toBeTruthy();
  expect(JSON.parse(String(init.body))).toEqual({
    expected_version: 3, parcel_weight_grams: 1500, parcel_quantity: 2,
  });
  expect(host.textContent).not.toContain('Missing parcel fields');
  expect(host.textContent).toContain('Parcel details complete for booking');
  await act(async () => root.unmount());
});

it('reuses the idempotency key after an unknown outcome and changes it for new input', async () => {
  const complete = {
    ...proposal, version: 4, parcel_weight_grams: 1500, parcel_quantity: 2,
    missing_parcel_fields: [], blockers: ['COURIER_CONNECTION_REQUIRED', 'LOCATION_METADATA_REQUIRED'],
  };
  const changed = { ...complete, version: 5, parcel_weight_grams: 1600 };
  const fetcher = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify(proposal)))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Outcome unknown. Retry the same request.' },
    }), { status: 503 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(complete)))
    .mockResolvedValueOnce(new Response(JSON.stringify(changed)));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<CourierDraft orderId="order-a" token="seller-a" />));
  await act(async () => {
    setInputValue(host.querySelector('input[name="parcelWeightKg"]')!, '1.5');
    setInputValue(host.querySelector('input[name="parcelQuantity"]')!, '2');
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  const firstKey = (fetcher.mock.calls[1][1]!.headers as Record<string, string>)['Idempotency-Key'];
  const retryKey = (fetcher.mock.calls[2][1]!.headers as Record<string, string>)['Idempotency-Key'];
  expect(retryKey).toBe(firstKey);
  await act(async () => {
    setInputValue(host.querySelector('input[name="parcelWeightKg"]')!, '1.6');
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  const changedKey = (fetcher.mock.calls[3][1]!.headers as Record<string, string>)['Idempotency-Key'];
  expect(changedKey).not.toBe(firstKey);
  await act(async () => root.unmount());
});

it('keeps entered parcel details on a stale save and reloads current values on request', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(new Response(JSON.stringify(proposal)))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: 'STALE_VERSION', message: 'Courier draft changed. Refresh before editing.' },
    }), { status: 409 }));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<CourierDraft orderId="order-a" token="seller-a" />));
  await act(async () => {
    setInputValue(host.querySelector('input[name="parcelWeightKg"]')!, '2.5');
    setInputValue(host.querySelector('input[name="parcelQuantity"]')!, '4');
    host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(host.textContent).toContain('changed');
  expect((host.querySelector('input[name="parcelWeightKg"]') as HTMLInputElement).value).toBe('2.5');
  expect((host.querySelector('input[name="parcelQuantity"]') as HTMLInputElement).value).toBe('4');
  expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
});

it('clears private details on identity change, ignores late responses and fails closed', async () => {
  let finish: (response: Response) => void = () => {};
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(proposal)))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce(new Response(JSON.stringify({error: {code: 'NOT_FOUND', message: 'Unavailable'}}), {status: 404}));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<CourierDraft orderId="order-a" token="seller-a" />));
  expect(host.textContent).toContain('Synthetic Buyer');
  await act(async () => root.render(<CourierDraft orderId="order-b" token="seller-b" />));
  expect(host.textContent).not.toContain('Synthetic Buyer');
  expect(host.textContent).toContain('Loading');
  await act(async () => root.render(<CourierDraft orderId="order-c" token="seller-c" />));
  await act(async () => finish(new Response(JSON.stringify(proposal))));
  expect(host.textContent).not.toContain('Synthetic Buyer');
  expect(host.textContent).toContain('unavailable');
  expect(fetcher).toHaveBeenCalledTimes(3);
  await act(async () => root.unmount());
});

it('handles access denial without details and retries to show zero COD', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
    error: {code: 'FORBIDDEN', message: 'Denied'},
  }), {status: 403})).mockResolvedValueOnce(new Response(JSON.stringify({ ...proposal, remaining_cod_minor: 0 })));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<CourierDraft orderId="order-a" token="seller-a" />));
  expect(host.textContent).toContain('access denied');
  expect(host.textContent).not.toContain('Synthetic Buyer');
  await act(async () => host.querySelector('button')!.click());
  expect(host.querySelector('.delivery-summary-amount')?.textContent).toBe('BDT 0.00');
  await act(async () => root.unmount());
});
