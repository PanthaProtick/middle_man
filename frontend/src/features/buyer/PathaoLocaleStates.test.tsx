import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PathaoLocations } from './PathaoLocations';
import type { PathaoSelection } from './pathaoTypes';
import { LOCALE_STORAGE_KEY, LocaleProvider, LocaleSwitch } from '../locale';
import { findLanguageButton } from './buyerLocaleFixtures';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'bn');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); window.localStorage.clear(); vi.restoreAllMocks();
});
async function render(value: PathaoSelection = {}) {
  await act(async () => root.render(<LocaleProvider><LocaleSwitch />
    <PathaoLocations portalToken="token" value={value} onChange={vi.fn()} />
  </LocaleProvider>));
}

it('translates an in-flight catalog without repeating the request and preserves authoritative names and IDs', async () => {
  let finish: (response: Response) => void = () => undefined;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(resolve => {finish = resolve;}));
  await render();
  expect(container.querySelector('section [role="status"]')?.textContent).toBe('Pathao-এর এলাকার তালিকা লোড হচ্ছে…');
  expect(container.querySelector('section')?.getAttribute('aria-label')).toBe('Pathao-এর ডেলিভারির এলাকা');
  await act(async () => findLanguageButton(container, 'English').click());
  expect(container.querySelector('section [role="status"]')?.textContent).toBe('Loading Pathao locations…');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => finish(new Response(JSON.stringify({condition: 'resolved', simulated: true,
    choices: [{id: 42, name: 'ঢাকা / Dhaka', home_delivery_available: false}]}))));
  const option = container.querySelector<HTMLOptionElement>('option[value="42"]')!;
  expect(option.textContent).toBe('ঢাকা / Dhaka — unsupported delivery');
  await act(async () => findLanguageButton(container, 'বাংলা').click());
  expect(option.textContent).toBe('ঢাকা / Dhaka — এখানে ডেলিভারি নেই');
  expect(option.value).toBe('42');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each([
  [{}, 'শহরের তালিকা খালি।', 'No cities are listed.'],
  [{city_id: 1}, 'জোনের তালিকা খালি।', 'No zones are listed.'],
  [{city_id: 1, zone_id: 10}, 'এলাকার তালিকা খালি।', 'No area choices are listed.'],
] as const)('translates empty catalogs while retaining written-address fallback for %j', async (value, bengali, english) => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
    const path = String(url);
    const choices = path.includes('zone_id=10') ? [] : path.includes('city_id=1')
      ? ('zone_id' in value ? [{id: 10, name: 'Zone'}] : [])
      : ('city_id' in value ? [{id: 1, name: 'Dhaka'}] : []);
    return new Response(JSON.stringify({condition: 'resolved', simulated: false, choices}));
  });
  await render(value);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(bengali);
  const calls = fetchMock.mock.calls.length;
  await act(async () => findLanguageButton(container, 'English').click());
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(english);
  expect(container.textContent).toContain('written address');
  expect(fetchMock).toHaveBeenCalledTimes(calls);
});

it('keeps all saved courier IDs when the language changes', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
    const path = String(url);
    return new Response(JSON.stringify({condition: 'resolved', simulated: false, choices:
      path.includes('zone_id=10') ? [{id: 100, name: 'Authoritative Area'}]
        : path.includes('city_id=1') ? [{id: 10, name: 'Authoritative Zone'}] : [{id: 1, name: 'Dhaka'}],
    }));
  });
  await render({city_id: 1, zone_id: 10, area_id: 100});
  const calls = fetchMock.mock.calls.length;
  await act(async () => findLanguageButton(container, 'English').click());
  expect(Array.from(container.querySelectorAll('select')).map(select => select.value)).toEqual(['1', '10', '100']);
  expect(container.textContent).toContain('Authoritative Area');
  expect(container.textContent).toContain('Authoritative Zone');
  expect(fetchMock).toHaveBeenCalledTimes(calls);
});
