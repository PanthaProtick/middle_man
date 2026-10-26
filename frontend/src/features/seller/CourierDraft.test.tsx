import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { CourierDraft } from './CourierDraft';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

const proposal = {
  order_id: 'order-a', status: 'local_proposal', recipient_name: 'Synthetic Buyer',
  contact_number: '01711111111', address: 'Synthetic Dhaka address', remaining_cod_minor: 1050000,
  blockers: ['PARCEL_DETAILS_REQUIRED', 'COURIER_CONNECTION_REQUIRED', 'LOCATION_METADATA_REQUIRED'],
};

it('shows the local proposal, accepted COD and actionable blockers', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(proposal)));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<CourierDraft orderId="order-a" token="seller-a" />));
  expect(host.textContent).toContain('Local courier proposal');
  expect(host.textContent).toContain('01711111111');
  expect(host.textContent).toContain('10500.00');
  expect(host.textContent).toContain('Add parcel');
  expect(host.textContent).toContain('Connect');
  expect(host.textContent).toContain('Select Pathao');
  expect(host.textContent).toContain('Payment acceptance does not independently verify receipt');
  expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer seller-a' });
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
  expect(host.textContent).toContain('Remaining COD: BDT 0.00');
  await act(async () => root.unmount());
});
