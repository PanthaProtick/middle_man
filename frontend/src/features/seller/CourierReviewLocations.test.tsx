import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { CourierReviewLocations } from './CourierReviewLocations';
import type { Review } from './courierReviewTypes';
import type { PathaoSelection } from '../buyer/pathaoTypes';

const review: Review = {
  token: 'review', reviewed: false, submission_enabled: false, blockers: [],
  choices: { environment: 'production', store_id: 7, delivery_type: 48, location: {} },
  connection: { environment: 'production', version: 2, status: 'connected', simulated: false,
    merchant_hint: null, default_store_id: 7, default_delivery_type: 48, production_booking_enabled: false },
  stores: [], location: { city_name: null, zone_name: null, area_name: null },
  draft: { version: 1, recipient_name: 'Synthetic', contact_number: '01700000000', address: 'Test',
    parcel_weight_grams: 1000, parcel_quantity: 1, remaining_cod_minor: 75000 },
};
const roots: ReturnType<typeof createRoot>[] = [];
afterEach(async () => {
  await act(async () => { for (const root of roots.splice(0)) root.unmount(); });
  vi.restoreAllMocks(); document.body.innerHTML = '';
});
function mount() {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); roots.push(root);
  function Form() {
    const [value, setValue] = useState<PathaoSelection>({});
    return <CourierReviewLocations path="/review" token="seller" review={review} value={value} onChange={setValue} />;
  }
  return { host, render: () => root.render(<Form />), select: (index: number) => host.querySelectorAll('select')[index] };
}
async function choose(select: HTMLSelectElement, value: string) {
  await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
}
const response = (choices: { id: number; name: string }[]) => Response.json({ choices });

it('shows each selection immediately while only its dependent options are pending', async () => {
  let resolveZones: (value: Response) => void = () => {};
  let resolveAreas: (value: Response) => void = () => {};
  const zones = new Promise<Response>(resolve => { resolveZones = resolve; });
  const areas = new Promise<Response>(resolve => { resolveAreas = resolve; });
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
    const query = String(url);
    if (query.includes('zone_id=')) return areas;
    if (query.includes('city_id=')) return zones;
    return response([{ id: 1, name: 'Dhaka' }]);
  });
  const form = mount(); await act(async () => form.render());
  await choose(form.select(0), '1');
  expect(form.select(0).value).toBe('1');
  expect(form.select(0).disabled).toBe(false);
  expect(form.select(1).disabled).toBe(true);
  expect(form.host.textContent).toContain('Loading Pathao zone');
  await act(async () => resolveZones(response([{ id: 10, name: 'Central' }])));
  await choose(form.select(1), '10');
  expect(form.select(0).value).toBe('1');
  expect(form.select(1).value).toBe('10');
  expect(form.select(1).disabled).toBe(false);
  expect(form.select(2).disabled).toBe(true);
  await act(async () => resolveAreas(response([{ id: 100, name: 'Test area' }])));
  await choose(form.select(2), '100');
  expect(Array.from(form.host.querySelectorAll('select'), select => select.value)).toEqual(['1', '10', '100']);
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('ignores an old city response and clears dependent selections immediately', async () => {
  let finishOld: (value: Response) => void = () => {};
  const oldZones = new Promise<Response>(resolve => { finishOld = resolve; });
  let oldSignal: AbortSignal | null | undefined;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    if (String(url).includes('city_id=1')) { oldSignal = options?.signal; return oldZones; }
    if (String(url).includes('city_id=2')) return response([{ id: 20, name: 'New zone' }]);
    return response([{ id: 1, name: 'Dhaka' }, { id: 2, name: 'Other city' }]);
  });
  const form = mount(); await act(async () => form.render());
  await choose(form.select(0), '1');
  await choose(form.select(0), '2');
  expect(oldSignal?.aborted).toBe(true);
  await choose(form.select(1), '20');
  await act(async () => finishOld(response([{ id: 10, name: 'Old zone' }])));
  expect(form.select(0).value).toBe('2');
  expect(form.select(1).value).toBe('20');
  expect(form.select(1).textContent).toContain('New zone');
  expect(form.select(1).textContent).not.toContain('Old zone');
  await choose(form.select(0), '');
  expect(Array.from(form.host.querySelectorAll('select'), select => select.value)).toEqual(['', '', '']);
  expect(form.select(1).disabled).toBe(true);
  expect(form.select(2).disabled).toBe(true);
});

it('keeps the chosen city available when its zones fail', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async url => String(url).includes('city_id=')
    ? Response.json({ error: { code: 'PATHAO_UNAVAILABLE', message: 'Unavailable' } }, { status: 503 })
    : response([{ id: 1, name: 'Dhaka' }]));
  const form = mount(); await act(async () => form.render());
  await choose(form.select(0), '1');
  expect(form.select(0).value).toBe('1');
  expect(form.select(0).disabled).toBe(false);
  expect(form.select(1).disabled).toBe(true);
  expect(form.host.querySelector('[role="alert"]')?.textContent).toContain('Reload current review to retry');
  expect(form.host.textContent).not.toContain('Loading Pathao zone');
});
