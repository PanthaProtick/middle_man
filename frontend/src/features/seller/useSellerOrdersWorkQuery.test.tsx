import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useSellerOrders } from './useSellerOrders';

function Harness({ token }: { token: string }): React.JSX.Element {
  const api = useSellerOrders(token, () => undefined);
  return <div>
    <span data-testid="work">{api.workQuery}</span>
    <span data-testid="status">{api.statusFilter}</span>
    <span data-testid="search">{api.search}</span>
    <span data-testid="mode">{api.dateMode}</span>
    <button onClick={() => api.applyWorkQuery('preparation')}>apply</button>
    <button onClick={() => api.changeSearch('bag')}>search</button>
    <button onClick={() => api.changeStatus('confirmed')}>status</button>
    <button onClick={() => api.applyRelativePreset(7)}>dates</button>
    <button onClick={api.reload}>reload</button>
  </div>;
}

async function mountHarness() {
  const urls: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    urls.push(String(input));
    return new Response(JSON.stringify({ items: [], next_cursor: null }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<Harness token="token" />));
  await act(async () => {});
  return { host, root, urls };
}

const click = async (host: HTMLElement, label: string) => {
  const button = Array.from(host.querySelectorAll('button')).find(item => item.textContent === label)!;
  await act(async () => button.click());
  await act(async () => {});
};

const last = (urls: string[]): string => urls.at(-1) ?? '';
const params = (url: string): URLSearchParams => new URLSearchParams(url.split('?')[1] ?? '');

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

it('applies the shared preparation query and clears status, search, and dates', async () => {
  const { host, urls } = await mountHarness();
  await click(host, 'status');
  await click(host, 'search');
  await click(host, 'dates');

  await click(host, 'apply');

  const applied = params(last(urls));
  expect(applied.get('work_query')).toBe('preparation');
  expect(applied.get('status')).toBeNull();
  expect(applied.get('search')).toBeNull();
  expect(applied.get('from_date')).toBeNull();
  expect(host.querySelector('[data-testid="work"]')?.textContent).toBe('preparation');
  expect(host.querySelector('[data-testid="status"]')?.textContent).toBe('');
  expect(host.querySelector('[data-testid="search"]')?.textContent).toBe('');
});

it('keeps the work query on reload and clears it when a manual filter is applied', async () => {
  const { host, urls } = await mountHarness();
  await click(host, 'apply');
  await click(host, 'reload');
  expect(params(last(urls)).get('work_query')).toBe('preparation');

  await click(host, 'search');
  expect(params(last(urls)).get('work_query')).toBeNull();
  expect(params(last(urls)).get('search')).toBe('bag');

  await click(host, 'apply');
  await click(host, 'status');
  expect(params(last(urls)).get('work_query')).toBeNull();
  expect(params(last(urls)).get('status')).toBe('confirmed');

  await click(host, 'apply');
  await click(host, 'dates');
  expect(params(last(urls)).get('work_query')).toBeNull();
  expect(params(last(urls)).get('from_date')).not.toBeNull();
});
