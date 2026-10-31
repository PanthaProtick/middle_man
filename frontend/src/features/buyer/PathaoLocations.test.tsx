import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { PathaoLocations } from './PathaoLocations';
import type { PathaoSelection } from './pathaoTypes';
import { LOCALE_STORAGE_KEY, LocaleProvider, LocaleSwitch } from '../locale';
import { findLanguageButton } from './buyerLocaleFixtures';

it('shows choices, resets children and retains the selection during a catalog retry', async () => {
  let fail = false;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
    if (fail) throw new TypeError('outage');
    const path = String(url);
    const choices = path.includes('zone_id=10') ? [{id: 100, name: 'Area'}]
      : path.includes('city_id=1') ? [{id: 10, name: 'Zone'}]
      : [{id: 1, name: 'Dhaka'}, {id: 2, name: 'Chattogram'}];
    return new Response(JSON.stringify({condition: 'resolved', environment: 'offline', simulated: true, choices}));
  });
  function Harness() {
    const [value, setValue] = useState<PathaoSelection>({});
    return <><PathaoLocations portalToken="synthetic" value={value} onChange={setValue} /><output>{JSON.stringify(value)}</output></>;
  }
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const select = async (name: string, value: string) => act(async () => {
    const node = container.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
    node.value = value;
    node.dispatchEvent(new Event('change', {bubbles: true}));
  });
  try {
    await act(async () => root.render(<Harness />));
    expect(container.textContent).toContain('Simulated');
    expect(container.querySelector('input[type="search"]')).toBeNull();
    await select('pathao_city', '1');
    await select('pathao_zone', '10');
    await select('pathao_area', '100');
    expect(container.querySelector('output')?.textContent).toContain('"area_id":100');
    fail = true;
    await act(async () => container.querySelector<HTMLButtonElement>('button')!.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('written address');
    expect(container.querySelector<HTMLSelectElement>('select[name="pathao_area"]')?.value).toBe('100');
    expect(container.querySelector('output')?.textContent).toContain('"area_id":100');
    fail = false;
    await act(async () => container.querySelector<HTMLButtonElement>('button')!.click());
    await select('pathao_city', '2');
    expect(container.querySelector('output')?.textContent).not.toContain('area_id');
    expect(container.querySelector('output')?.textContent).not.toContain('zone_id');
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks();
  }
});

it('switches catalog failures and selected locations without another read or lost focus, then recovers', async () => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'bn');
  let fail = true;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    if (fail) throw new TypeError('Private provider detail');
    return new Response(JSON.stringify({condition: 'resolved', simulated: false, choices: [{id: 1, name: 'Dhaka'}]}));
  });
  const onChange = vi.fn();
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<LocaleProvider><LocaleSwitch />
      <PathaoLocations portalToken="token" value={{city_id: 1}} onChange={onChange} />
    </LocaleProvider>));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Pathao-এর এলাকার তালিকা পাওয়া যাচ্ছে না।');
    expect(container.textContent).not.toContain('Private provider detail');
    expect(container.querySelector('select[name="pathao_city"]')?.textContent).toContain('সংরক্ষিত এলাকা (ID 1)');
    const city = container.querySelector<HTMLSelectElement>('select[name="pathao_city"]')!;
    city.focus();
    const calls = fetchMock.mock.calls.length;
    await act(async () => findLanguageButton(container, 'English').click());
    expect(fetchMock).toHaveBeenCalledTimes(calls);
    expect(document.activeElement).toBe(city);
    expect(container.textContent).toContain('Pathao locations are unavailable.');
    expect(onChange).not.toHaveBeenCalled();
    fail = false;
    const retry = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Retry location lookup')!;
    await act(async () => retry.click());
    expect(container.querySelector('select[name="pathao_city"]')?.textContent).toContain('Dhaka');
    expect(container.querySelector<HTMLSelectElement>('select[name="pathao_city"]')?.value).toBe('1');
    expect(onChange).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount()); container.remove(); window.localStorage.clear(); vi.restoreAllMocks();
  }
});
