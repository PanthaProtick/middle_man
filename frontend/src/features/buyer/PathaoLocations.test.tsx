import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { PathaoLocations } from './PathaoLocations';
import type { PathaoSelection } from './pathaoTypes';
import { LOCALE_STORAGE_KEY, LocaleProvider, LocaleSwitch } from '../locale';
import { findLanguageButton } from './buyerLocaleFixtures';

it('shows choices and clears child selections when the city changes', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
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
    expect(container.textContent).not.toContain('Retry location lookup');
    await select('pathao_city', '2');
    expect(container.querySelector('output')?.textContent).not.toContain('area_id');
    expect(container.querySelector('output')?.textContent).not.toContain('zone_id');
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks();
  }
});

it('switches catalog failures and selected locations without another read or lost focus, preserves fallback', async () => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'bn');
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    throw new TypeError('Private provider detail');
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
    expect(container.textContent).not.toContain('Retry location lookup');
  } finally {
    await act(async () => root.unmount()); container.remove(); window.localStorage.clear(); vi.restoreAllMocks();
  }
});
