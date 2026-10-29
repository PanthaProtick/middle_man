import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BuyerPortal } from './BuyerPortal';
import { awaitingOrder, findLanguageButton } from './buyerLocaleFixtures';
import { LOCALE_STORAGE_KEY, LocaleProvider, LocaleSwitch } from '../locale';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

function edit(name: string, value: string) {
  const input = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)!;
  const prototype = input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', {bubbles: true}));
}
function select(name: string, value: string) {
  const node = container.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
  node.value = value;
  node.dispatchEvent(new Event('change', {bubbles: true}));
}
async function fill() {
  await act(async () => {
    edit('buyer_name', 'Synthetic Buyer');
    edit('contact_number', '01711111111');
    edit('address_raw', 'House 12, Road 5, gate code 1234');
    edit('payment_sender', '01822222222');
    edit('payment_trx_id', 'SYNTHETIC');
  });
}
async function submit() {
  await act(async () => container.querySelector('form')!.dispatchEvent(
    new Event('submit', {bubbles: true, cancelable: true})));
}
function postBodies(fetchMock: ReturnType<typeof routedFetch>) {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')
    .map(([, init]) => JSON.parse(String(init?.body)));
}
function catalog(choices: unknown[]) {
  return new Response(JSON.stringify({condition: 'resolved', environment: 'offline', simulated: true, choices}));
}
function routedFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) =>
    handler(String(url), init));
}
async function renderPortal(fetchMock: ReturnType<typeof routedFetch>) {
  await act(async () => root.render(
    <LocaleProvider><LocaleSwitch /><BuyerPortal portalToken="token" /></LocaleProvider>,
  ));
  expect(fetchMock).toHaveBeenCalledWith('/api/public/orders/token', expect.anything());
}

it('requires every available choice, focuses the first gap and submits server-derived IDs', async () => {
  const fetchMock = routedFetch(async (url, init) => {
    if (init?.method === 'POST') return new Response(JSON.stringify({...awaitingOrder, lifecycle: 'pending'}));
    if (url === '/api/public/orders/token') return new Response(JSON.stringify(awaitingOrder));
    const choices = url.includes('zone_id=10') ? [{id: 100, name: 'Area'}]
      : url.includes('city_id=1') ? [{id: 10, name: 'Zone'}] : [{id: 1, name: 'Dhaka'}];
    return catalog(choices);
  });
  await renderPortal(fetchMock);
  await fill();
  await submit();
  expect(postBodies(fetchMock)).toHaveLength(0);
  expect(document.activeElement).toBe(container.querySelector('[name="pathao_city"]'));
  expect(container.querySelector('#pathao_city-error')?.textContent).toContain('Choose an available Pathao city');
  await act(async () => findLanguageButton(container, 'বাংলা').click());
  expect(container.querySelector('#pathao_city-error')?.textContent).toContain('Pathao-এর শহর বেছে নিন');
  await act(async () => findLanguageButton(container, 'English').click());

  await act(async () => select('pathao_city', '1'));
  await act(async () => select('pathao_zone', '10'));
  await submit();
  expect(postBodies(fetchMock)).toHaveLength(0);
  expect(document.activeElement).toBe(container.querySelector('[name="pathao_area"]'));
  expect(container.querySelector('#pathao_area-error')?.textContent).toContain('area');

  await act(async () => select('pathao_area', '100'));
  await submit();
  const bodies = postBodies(fetchMock);
  expect(bodies).toHaveLength(1);
  expect(bodies[0].address).toEqual({
    raw_text: 'House 12, Road 5, gate code 1234',
    pathao: {city_id: 1, zone_id: 10, area_id: 100},
  });
});

it('blocks in-flight lookups, then allows established unavailability while preserving drafts and language', async () => {
  let finishCatalog: (response: Response) => void = () => undefined;
  const fetchMock = routedFetch(async (url, init) => {
    if (init?.method === 'POST') return new Response(JSON.stringify({...awaitingOrder, lifecycle: 'pending'}));
    if (url === '/api/public/orders/token') return new Response(JSON.stringify(awaitingOrder));
    return new Promise<Response>(resolve => { finishCatalog = resolve; });
  });
  await renderPortal(fetchMock);
  await fill();
  await submit();
  expect(postBodies(fetchMock)).toHaveLength(0);
  expect(container.textContent).toContain('Wait for Pathao locations to finish loading');
  expect(container.querySelector<HTMLTextAreaElement>('[name="address_raw"]')?.value).toBe('House 12, Road 5, gate code 1234');
  expect(container.querySelector<HTMLInputElement>('[name="payment_trx_id"]')?.value).toBe('SYNTHETIC');

  const calls = fetchMock.mock.calls.length;
  await act(async () => findLanguageButton(container, 'বাংলা').click());
  expect(container.textContent).toContain('Pathao-এর এলাকার তালিকা লোড হওয়া পর্যন্ত অপেক্ষা করুন');
  expect(fetchMock).toHaveBeenCalledTimes(calls);

  await act(async () => finishCatalog(new Response('provider detail', {status: 503})));
  expect(container.textContent).toContain('Pathao-এর এলাকার তালিকা পাওয়া যাচ্ছে না');
  await submit();
  const bodies = postBodies(fetchMock);
  expect(bodies).toHaveLength(1);
  expect(bodies[0].address).toEqual({raw_text: 'House 12, Road 5, gate code 1234'});
  expect(bodies[0].payment_claim).toMatchObject({trx_id: 'SYNTHETIC', sender_number: '01822222222'});
});

it('uses written fallback for empty catalogs and no-area zones without inventing IDs', async () => {
  let emptyAreas = false;
  const fetchMock = routedFetch(async (url, init) => {
    if (init?.method === 'POST') return new Response(JSON.stringify({...awaitingOrder, lifecycle: 'pending'}));
    if (url === '/api/public/orders/token') return new Response(JSON.stringify(awaitingOrder));
    if (url.includes('city_id=1&zone_id=10')) return catalog(emptyAreas ? [] : [{id: 100, name: 'Area'}]);
    if (url.includes('city_id=1')) return catalog([{id: 10, name: 'Zone'}]);
    return catalog(emptyAreas ? [] : [{id: 1, name: 'Dhaka'}]);
  });
  await renderPortal(fetchMock);
  await fill();
  emptyAreas = true;
  await act(async () => select('pathao_city', '1'));
  await act(async () => select('pathao_zone', '10'));
  expect(container.textContent).toContain('No area choices are listed');
  await submit();
  const bodies = postBodies(fetchMock);
  expect(bodies).toHaveLength(1);
  expect(bodies[0].address.pathao).toEqual({city_id: 1, zone_id: 10});
});

it.each(['city', 'zone'] as const)('uses written fallback when the %s catalog is empty', async level => {
  const fetchMock = routedFetch(async (url, init) => {
    if (init?.method === 'POST') return new Response(JSON.stringify({...awaitingOrder, lifecycle: 'pending'}));
    if (url === '/api/public/orders/token') return new Response(JSON.stringify(awaitingOrder));
    if (level === 'city') return catalog([]);
    return url.includes('city_id=1') ? catalog([]) : catalog([{id: 1, name: 'Dhaka'}]);
  });
  await renderPortal(fetchMock);
  await fill();
  if (level === 'zone') await act(async () => select('pathao_city', '1'));
  expect(container.textContent).toContain(level === 'city' ? 'No cities are listed' : 'No zones are listed');
  await submit();
  const bodies = postBodies(fetchMock);
  expect(bodies).toHaveLength(1);
  expect(bodies[0].address).toEqual({
    raw_text: 'House 12, Road 5, gate code 1234',
    ...(level === 'zone' ? {pathao: {city_id: 1}} : {}),
  });
  expect(bodies[0].payment_claim).toMatchObject({trx_id: 'SYNTHETIC', sender_number: '01822222222'});
});

it.each(['REQUIRED', 'INVALID'] as const)('localizes and focuses a server-enforced %s choice', async code => {
  const fetchMock = routedFetch(async (url, init) => {
    if (init?.method === 'POST') return new Response(JSON.stringify({
      error: {
        code: `PATHAO_LOCATION_${code}`, message: 'Choose a location',
        fields: [{field: 'address.pathao.city_id', code: `pathao_location_${code.toLowerCase()}`, message: 'Choose a city'}],
      },
    }), {status: 422});
    if (url === '/api/public/orders/token') return new Response(JSON.stringify(awaitingOrder));
    const choices = url.includes('zone_id=10') ? [{id: 100, name: 'Area'}]
      : url.includes('city_id=1') ? [{id: 10, name: 'Zone'}] : [{id: 1, name: 'Dhaka'}];
    return catalog(choices);
  });
  await renderPortal(fetchMock);
  await fill();
  await act(async () => select('pathao_city', '1'));
  await act(async () => select('pathao_zone', '10'));
  await act(async () => select('pathao_area', '100'));
  await submit();
  expect(container.textContent).toContain(code === 'REQUIRED'
    ? 'Choose the available Pathao city, zone, and area' : 'selected Pathao location is no longer valid');
  expect(container.querySelector('#pathao_city-error')?.textContent).toContain(code === 'REQUIRED'
    ? 'Choose an available Pathao city' : 'selected Pathao location is no longer valid');
  expect(document.activeElement).toBe(container.querySelector('[name="pathao_city"]'));
  await act(async () => findLanguageButton(container, 'বাংলা').click());
  expect(container.querySelector('#pathao_city-error')?.textContent).toContain(code === 'REQUIRED'
    ? 'Pathao-এর শহর বেছে নিন' : 'নির্বাচিত Pathao এলাকাটি আর বৈধ নয়');
});
