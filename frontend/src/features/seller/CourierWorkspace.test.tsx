import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { CourierWorkspace } from './CourierWorkspace';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

it('keeps unsaved parcel input and uses the shared version after saving delivery choices', async () => {
  let version = 3;
  const draft = { order_id: 'a', status: 'local_proposal', version, recipient_name: 'Buyer', contact_number: '01711111111',
    address: 'Dhaka', remaining_cod_minor: 1000000, parcel_weight_grams: null, parcel_quantity: null,
    missing_parcel_fields: ['weight', 'quantity'], blockers: ['PARCEL_DETAILS_REQUIRED'] };
  const review = { token: 'a'.repeat(64), reviewed: false, submission_enabled: false, blockers: ['PARCEL_DETAILS_REQUIRED'],
    choices: { environment: 'offline', store_id: null, delivery_type: 48, location: {} },
    connection: { status: 'disconnected', version: 0, simulated: true }, stores: [], location: {}, draft };
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method === 'PUT') { version += 1; return new Response(JSON.stringify({ ...review, draft: { ...draft, version } })); }
    if (init?.method === 'PATCH') { version += 1; return new Response(JSON.stringify({ ...draft, version, parcel_quantity: 2 })); }
    return new Response(JSON.stringify(String(url).endsWith('/courier-draft') ? draft : review));
  });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<CourierWorkspace orderId="a" token="seller" />));
  const input = host.querySelector<HTMLInputElement>('input[name="parcelQuantity"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '2');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const service = Array.from(host.querySelectorAll('select')).find(select => select.closest('label')?.textContent?.includes('Delivery service'))!;
  await act(async () => { service.value = '12'; service.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Save delivery choices')!.click());
  expect(input.value).toBe('2');
  await act(async () => input.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  const write = fetcher.mock.calls.find(call => call[1]?.method === 'PATCH');
  expect(JSON.parse(String(write?.[1]?.body))).toMatchObject({ expected_version: 4, parcel_quantity: 2 });
  await act(async () => root.unmount());
});
