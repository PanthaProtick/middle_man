import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { PathaoLocations } from './PathaoLocations';
import type { PathaoSelection } from './pathaoTypes';

it('searches choices, resets children and retains the selection during a catalog retry', async () => {
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
    const search = container.querySelector<HTMLInputElement>('input[type="search"]')!;
    const searchFor = (text: string) => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, text);
      search.dispatchEvent(new Event('input', {bubbles: true}));
    });
    await searchFor('chatto');
    expect(container.querySelector('select[name="pathao_city"]')?.textContent).not.toContain('Dhaka');
    expect(container.querySelector('select[name="pathao_city"]')?.textContent).toContain('Chattogram');
    await searchFor('');
    await select('pathao_city', '1');
    await select('pathao_zone', '10');
    await select('pathao_area', '100');
    expect(container.querySelector('output')?.textContent).toContain('"area_id":100');
    fail = true;
    await act(async () => container.querySelector<HTMLButtonElement>('button')!.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('written address');
    expect(container.querySelector('select[name="pathao_area"]')?.textContent).toContain('Saved choice (ID 100)');
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
