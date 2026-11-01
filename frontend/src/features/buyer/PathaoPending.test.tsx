import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { PathaoLocations } from './PathaoLocations';
import type { PathaoSelection } from './pathaoTypes';

it('reports removed parent choices as invalid rather than an expired active catalogue', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
    const query = new URL(String(url), 'http://test').searchParams;
    return query.has('city_id')
      ? new Response(JSON.stringify({error: {code: 'PATHAO_LOCATION_INVALID'}}), {status: 422})
      : new Response(JSON.stringify({condition: 'resolved', catalog_version: 'current',
        choices: [{id: 2, name: 'Current city'}]}));
  });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<PathaoLocations portalToken="token"
      value={{city_id: 1}} onChange={vi.fn()} />));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('no longer valid');
    expect(container.querySelector<HTMLSelectElement>('[name="pathao_city"]')?.disabled).toBe(false);
    expect(container.textContent).toContain('Current city');
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks();
  }
});

it('keeps parents interactive during slow child reads, ignores late responses and remembers lists', async () => {
  const pending = new Map<string, (response: Response) => void>();
  const response = (choices: {id: number; name: string}[]) => new Response(JSON.stringify({
    condition: 'resolved', catalog_version: 'snapshot-1', simulated: false, choices,
  }));
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
    const query = new URL(String(url), 'http://test').searchParams;
    const city = query.get('city_id');
    if (!city) return response([{id: 1, name: 'Dhaka'}, {id: 2, name: 'Chattogram'}]);
    return new Promise<Response>(resolve => pending.set(query.has('zone_id') ? `area-${city}` : city, resolve));
  });
  function Harness() {
    const [value, onChange] = useState<PathaoSelection>({});
    return <PathaoLocations portalToken="token" value={value} onChange={onChange} />;
  }
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const city = () => container.querySelector<HTMLSelectElement>('[name="pathao_city"]')!;
  const zone = () => container.querySelector<HTMLSelectElement>('[name="pathao_zone"]')!;
  const choose = async (id: string) => act(async () => {
    city().value = id;
    city().dispatchEvent(new Event('change', {bubbles: true}));
  });
  try {
    await act(async () => root.render(<Harness />));
    await choose('1');
    expect(city().selectedOptions[0].textContent).toBe('Dhaka');
    expect(city().disabled).toBe(false);
    expect(zone().disabled).toBe(true);
    expect(container.querySelector('[role="status"]')?.parentElement?.querySelector('select')?.name).toBe('pathao_city');
    expect(container.querySelector('.pathao-location-spinner')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await choose('2');
    await act(async () => pending.get('2')!(response([{id: 20, name: 'Current zone'}])));
    await act(async () => pending.get('1')!(response([{id: 10, name: 'Late zone'}])));
    expect(zone().textContent).toContain('Current zone');
    expect(zone().textContent).not.toContain('Late zone');
    expect(city().value).toBe('2');
    expect(container.querySelector('[role="status"]')).toBeNull();
    await act(async () => {
      zone().value = '20';
      zone().dispatchEvent(new Event('change', {bubbles: true}));
    });
    expect(container.querySelector('[role="status"]')?.parentElement?.querySelector('select')?.name).toBe('pathao_zone');
    await act(async () => pending.get('area-2')!(response([{id: 200, name: 'Current area'}])));
    expect(container.querySelector('[role="status"]')).toBeNull();
    await choose('');
    await choose('2');
    expect(zone().disabled).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[2][0])).toContain('catalog_version=snapshot-1');
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks();
  }
});

it('reports an expired pinned version without clearing other details', async () => {
  const availability = vi.fn();
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
    const query = new URL(String(url), 'http://test').searchParams;
    if (query.get('catalog_version') === 'expired-version') return new Response(JSON.stringify({
      error: {code: 'PATHAO_CATALOG_EXPIRED'},
    }), {status: 422});
    const choices = query.has('zone_id') ? [{id: 100, name: 'Current area'}]
      : query.has('city_id') ? [{id: 10, name: 'Current zone'}] : [{id: 1, name: 'Current city'}];
    return new Response(JSON.stringify({condition: 'resolved', catalog_version: 'current-version', simulated: false, choices}));
  });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<><input aria-label="Written address" defaultValue="Keep my written address" />
      <PathaoLocations portalToken="token" value={{city_id: 1, zone_id: 10, area_id: 100, catalog_version: 'expired-version'}}
        onChange={vi.fn()} onAvailabilityChange={availability} /></>));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Clear location choices');
    expect(container.textContent).not.toContain('Retry location lookup');
    expect(container.querySelector<HTMLInputElement>('input')?.value).toBe('Keep my written address');
    expect(availability).toHaveBeenLastCalledWith({state: 'unavailable', city: false, zone: false, area: false});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks();
  }
});
