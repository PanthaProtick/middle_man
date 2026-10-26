import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { CourierReview } from './CourierReview';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

const review = {
  token: 'a'.repeat(64), reviewed: false, submission_enabled: false, blockers: [],
  choices: { environment: 'offline', store_id: 7, delivery_type: 48, location: { city_id: 1, zone_id: 10, area_id: 100 } },
  connection: { status: 'connected', version: 2, merchant_hint: 'Simulated merchant', simulated: true },
  stores: [{ id: 7, name: 'My pickup store' }], location: { city_name: 'Dhaka', zone_name: 'Central', area_name: 'Covered' },
  draft: { recipient_name: 'Current Buyer', contact_number: '01711111111', address: 'Current address',
    parcel_weight_grams: 1500, parcel_quantity: 2, remaining_cod_minor: 0 },
};

it('reviews current COD and metadata without offering external submission', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) =>
    new Response(JSON.stringify(String(url).includes('/locations?') ? { choices: [] }
      : init?.method === 'POST' ? { ...review, reviewed: true } : review)));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<CourierReview orderId="a" token="seller" />));
  expect(host.textContent).toContain('Current Buyer');
  expect(host.textContent).toContain('0.00');
  expect(host.textContent).toContain('My pickup store');
  await act(async () => host.querySelector<HTMLButtonElement>('[data-review]')!.click());
  expect(JSON.parse(String(fetcher.mock.calls.at(-1)?.[1]?.body))).toEqual({ expected_token: review.token });
  expect(host.textContent).toContain('Review complete');
  expect(host.textContent).toContain('External booking is unavailable');
  await act(async () => root.unmount());
});

it('blocks incomplete review, reports save failures and reloads current data', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (String(url).includes('/locations?')) return new Response(JSON.stringify({ choices: [] }));
    if (init?.method === 'PUT') return new Response(JSON.stringify({ error: { code: 'STALE_VERSION', message: 'Changed' } }), { status: 409 });
    return new Response(JSON.stringify({ ...review, blockers: ['LOCATION_METADATA_REQUIRED', 'PICKUP_STORE_REQUIRED'] }));
  });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<CourierReview orderId="a" token="seller" />));
  expect(host.querySelector<HTMLButtonElement>('[data-review]')!.disabled).toBe(true);
  expect(host.textContent).toContain('supported delivery coverage');
  const service = Array.from(host.querySelectorAll('select')).find(select => select.closest('label')?.textContent?.includes('Delivery service'))!;
  await act(async () => {
    service.value = '12'; service.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Save delivery choices')!.click());
  const write = fetcher.mock.calls.find(call => call[1]?.method === 'PUT');
  expect(JSON.parse(String(write?.[1]?.body))).toMatchObject({ delivery_type: 12, expected_token: review.token });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Reload and review current details');
  await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Reload current review')!.click());
  expect(host.textContent).toContain('Current Buyer');
  await act(async () => root.unmount());
});

it('discards a late review completion after changing seller sessions', async () => {
  let resolveOld: (response: Response) => void = () => {};
  const old = new Promise<Response>(resolve => { resolveOld = resolve; });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (String(url).includes('/locations?')) return new Response(JSON.stringify({ choices: [] }));
    if (init?.method === 'POST') return old;
    const isNew = new Headers(init?.headers).get('Authorization') === 'Bearer new-seller';
    return new Response(JSON.stringify(isNew ? { ...review, draft: { ...review.draft, recipient_name: 'New shop buyer' } } : review));
  });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<CourierReview orderId="a" token="old-seller" />));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-review]')!.click());
  await act(async () => root.render(<CourierReview orderId="b" token="new-seller" />));
  expect(host.textContent).toContain('New shop buyer');
  await act(async () => resolveOld(new Response(JSON.stringify({ ...review, reviewed: true }))));
  expect(host.textContent).toContain('New shop buyer');
  expect(host.textContent).not.toContain('Current Buyer');
  expect(host.textContent).not.toContain('Review complete');
  await act(async () => root.unmount());
});

it('loads dependent locations and clears children when the seller changes city', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const query = String(url);
    if (!query.includes('/locations?')) return new Response(JSON.stringify(review));
    const choices = query.includes('zone_id=10') ? [{ id: 100, name: 'Covered' }]
      : query.includes('city_id=1') ? [{ id: 10, name: 'Central' }]
      : query.includes('city_id=2') ? [] : [{ id: 1, name: 'Dhaka' }, { id: 2, name: 'Chattogram' }];
    return new Response(JSON.stringify({ choices }));
  });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<CourierReview orderId="a" token="seller" />));
  const locationSelects = () => host.querySelectorAll<HTMLSelectElement>('[aria-label="Seller destination selection"] select');
  expect(Array.from(locationSelects(), select => select.value)).toEqual(['1', '10', '100']);
  await act(async () => {
    locationSelects()[0].value = '2'; locationSelects()[0].dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(Array.from(locationSelects(), select => select.value)).toEqual(['2', '', '']);
  expect(host.querySelector<HTMLButtonElement>('[data-review]')!.disabled).toBe(true);
  expect(host.textContent).toContain('Save changes before reviewing');
  await act(async () => root.unmount());
});
