import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { PathaoSettings } from './PathaoSettings';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

const disconnected = { environment: 'offline', version: 0, status: 'disconnected', simulated: true,
  merchant_hint: null, default_store_id: null, default_delivery_type: null, production_booking_enabled: false };

it('connects simulated settings and saves an explicitly chosen store and service', async () => {
  let current = disconnected;
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    if (String(url).includes('/stores')) return Response.json({ environment: 'offline', version: current.version,
      simulated: true, stores: [{ id: 123, name: 'Simulated pickup store' }] });
    if (options?.method === 'PUT') current = { ...current, version: 1, status: 'connected' };
    if (options?.method === 'PATCH') current = { ...current, version: 2,
      ...JSON.parse(String(options.body)) as { default_store_id: null; default_delivery_type: null } };
    return Response.json(current);
  });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<PathaoSettings token="seller-a" />));
  expect(host.textContent).toContain('disconnected');
  expect(host.textContent).toContain('Production booking is disabled');
  await act(async () => host.querySelector<HTMLFormElement>('form')!.requestSubmit());
  expect(host.textContent).toContain('connected');
  const store = host.querySelector<HTMLSelectElement>('[name="pickup"]')!;
  expect(store.value).toBe('');
  await act(async () => { store.value = '123'; store.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => host.querySelector<HTMLFormElement>('form[data-defaults]')!.requestSubmit());
  expect(fetcher.mock.calls.some(([, options]) => options?.method === 'PATCH' &&
    JSON.parse(String(options.body)).default_store_id === 123)).toBe(true);
  expect(host.textContent).toContain('Revision 2');
  await act(async () => root.unmount());
});

it('clears merchant fields on submit and ignores old-session connection and store responses', async () => {
  let resolveOld: (response: Response) => void = () => {};
  const oldResponse = new Promise<Response>(resolve => { resolveOld = resolve; });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
    const headers = new Headers(options?.headers);
    if (headers.get('Authorization') === 'Bearer old-seller') return oldResponse;
    return Response.json(disconnected);
  });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<PathaoSettings token="old-seller" />));
  await act(async () => root.render(<PathaoSettings token="new-seller" />));
  await act(async () => resolveOld(Response.json({ ...disconnected, version: 99, merchant_hint: 'Old merchant' })));
  expect(host.textContent).not.toContain('Old merchant');
  expect(host.textContent).toContain('Revision 0');
  await act(async () => root.unmount());
});

it('clears secrets after rejection and removes settings after session loss', async () => {
  let unauthorized = false;
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
    if (unauthorized) return Response.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in' } }, { status: 401 });
    if (options?.method === 'PUT') return Response.json({ error: {
      code: 'PATHAO_CREDENTIALS_REJECTED', message: 'Rejected',
    } }, { status: 422 });
    return Response.json({ ...disconnected, environment: 'sandbox', simulated: false });
  });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<PathaoSettings token="seller" />));
  const env = host.querySelector<HTMLSelectElement>('select')!;
  await act(async () => { env.value = 'sandbox'; env.dispatchEvent(new Event('change', { bubbles: true })); });
  const secrets: Record<string, string> = { client_id: 'synthetic-id', client_secret: 'synthetic-secret',
    username: 'merchant@example.test', password: 'synthetic-password' };
  for (const [name, value] of Object.entries(secrets)) host.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value = value;
  await act(async () => host.querySelector<HTMLFormElement>('form')!.requestSubmit());
  expect(host.querySelector<HTMLInputElement>('[name="password"]')!.value).toBe('');
  expect(host.querySelector<HTMLInputElement>('[name="client_secret"]')!.value).toBe('');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Check credentials');
  const mutation = fetcher.mock.calls.find(([, options]) => options?.method === 'PUT');
  expect(JSON.parse(String(mutation?.[1]?.body)).credentials).toEqual(secrets);
  unauthorized = true;
  await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Reload settings')!.click());
  expect(host.textContent).toContain('Session lost');
  expect(host.querySelector('form')).toBeNull();
  await act(async () => root.unmount());
});

it('ends loading on an initial outage and recovers by reloading', async () => {
  let outage = true;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => outage
    ? Response.json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Unavailable' } }, { status: 503 })
    : Response.json(disconnected));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<PathaoSettings token="seller" />));
  expect(host.querySelector('[role="status"]')?.textContent).toBe('Settings unavailable');
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  outage = false;
  await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Reload settings')!.click());
  expect(host.textContent).toContain('disconnected');
  expect(host.querySelector('[role="alert"]')).toBeNull();
  await act(async () => root.unmount());
});
