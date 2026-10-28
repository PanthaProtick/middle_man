import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { PathaoSettings } from './PathaoSettings';

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); document.body.innerHTML = ''; });

it('switches settings language without resetting the environment, secrets, focus, or requesting Pathao again', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({
    environment: 'sandbox', version: 7, status: 'disconnected', simulated: false,
    merchant_hint: 'Merchant ১২', default_store_id: null, default_delivery_type: null,
    production_booking_enabled: false,
  }));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><PathaoSettings token="seller" /></LocaleProvider>));
  const environment = host.querySelector<HTMLSelectElement>('select')!;
  await act(async () => { environment.value = 'sandbox'; environment.dispatchEvent(new Event('change', { bubbles: true })); });
  const secret = host.querySelector<HTMLInputElement>('[name="client_secret"]')!;
  secret.value = 'synthetic-secret'; secret.focus();
  const before = fetcher.mock.calls.length;
  await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'বাংলা')!.click());
  expect(environment.value).toBe('sandbox');
  expect(secret.value).toBe('synthetic-secret');
  expect(document.activeElement).toBe(secret);
  expect(host.textContent).toContain('প্রোডাকশনে বুকিং বন্ধ আছে');
  expect(host.textContent).toContain('সংশোধন 7');
  expect(host.textContent).not.toContain('synthetic-secret');
  expect(fetcher).toHaveBeenCalledTimes(before);
  await act(async () => root.unmount());
});

it('keeps a selected provider store and translates a saved settings failure without another request', async () => {
  localStorage.setItem('middleman.locale', 'bn');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method === 'PATCH') return Response.json({ error: { code: 'STALE_VERSION', message: 'Private provider detail' } }, { status: 409 });
    if (String(url).includes('/stores')) return Response.json({ environment: 'offline', version: 2, simulated: true,
      stores: [{ id: 123, name: 'My Store ১২' }] });
    return Response.json({ environment: 'offline', version: 2, status: 'connected', simulated: true,
      merchant_hint: 'Merchant ১২', default_store_id: null, default_delivery_type: null,
      production_booking_enabled: false });
  });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><PathaoSettings token="seller" /></LocaleProvider>));
  const store = host.querySelector<HTMLSelectElement>('[name="pickup"]')!;
  await act(async () => { store.value = '123'; store.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => host.querySelector<HTMLFormElement>('[data-defaults]')!.requestSubmit());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('সেটিংস বদলেছে');
  expect(host.textContent).not.toContain('Private provider detail');
  const before = fetcher.mock.calls.length;
  await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'English')!.click());
  expect(store.value).toBe('123');
  expect(host.textContent).toContain('My Store ১২');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('settings changed');
  expect(fetcher).toHaveBeenCalledTimes(before);
  await act(async () => root.unmount());
});
