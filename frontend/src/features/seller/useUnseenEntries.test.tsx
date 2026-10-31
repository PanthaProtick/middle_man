import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useUnseenEntries } from './useUnseenEntries';
import { WorkspaceSectionNav } from './WorkspaceSectionNav';
import type { WorkspaceSection } from './SellerWorkspace';

const T1 = '2026-10-31T10:00:00Z';
const T2 = '2026-10-31T11:00:00Z';
const key = 'seller-unseen-v1:shop';
const lists: never[] = [];
let root: Root;
let host: HTMLDivElement;

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
  localStorage.clear();
  vi.restoreAllMocks();
});

function Harness({ section = 'orders', shop = 'shop', revision = lists }: {
  section?: WorkspaceSection; shop?: string; revision?: unknown;
}) {
  const counts = useUnseenEntries('seller', shop, section, revision, lists, lists, true);
  return <WorkspaceSectionNav currentSection={section} onSelectSection={() => undefined}
    ordersCount={counts.orders} transactionsCount={counts.payments} accountsCount={counts.accounts} />;
}

async function mount() {
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
}

const reply = (orders = 0, payments = 0, accounts = 0, captured_at = T1) =>
  new Response(JSON.stringify({ orders, payments, accounts, captured_at }));
const badges = () => Array.from(host.querySelectorAll('.section-tab-count'), el => el.textContent);

it('baselines first visits, hides zero badges and preserves unseen times across reloads', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply());
  await mount();
  await act(async () => root.render(<Harness />));
  expect(badges()).toEqual([]);
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ orders: T1, payments: T1, accounts: T1 });
  fetcher.mockResolvedValue(reply(5, 120, 2, T2));
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(badges()).toEqual(['120', '2']);
  expect(host.querySelector('.section-tab-count')?.getAttribute('aria-label')).toContain('new entries');
  const url = new URL(String(fetcher.mock.calls.at(-1)![0]), 'http://localhost');
  expect(url.searchParams.get('payments_since')).toBe(T1);
  expect(url.searchParams.has('orders_since')).toBe(false);
  fetcher.mockResolvedValue(reply(0, 0, 2, T2));
  await act(async () => root.render(<Harness section="payments" />));
  expect(badges()).toEqual(['2']);
  expect(JSON.parse(localStorage.getItem(key)!).payments).toBe(T2);
  await act(async () => root.unmount());
  root = createRoot(host);
  await act(async () => root.render(<Harness />));
  const reloadUrl = new URL(String(fetcher.mock.calls.at(-1)![0]), 'http://localhost');
  expect(reloadUrl.searchParams.get('payments_since')).toBe(T2);
});

it('ignores stale responses, hides failures, and isolates shops and list filters', async () => {
  localStorage.setItem(key, JSON.stringify({ orders: T1, payments: T1, accounts: T1 }));
  const pending: Array<(response: Response) => void> = [];
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    new Promise<Response>(resolve => pending.push(resolve)));
  await mount();
  await act(async () => root.render(<Harness />));
  await act(async () => root.render(<Harness revision="filtered-page" />));
  expect(fetcher.mock.calls[0][0]).toBe(fetcher.mock.calls[1][0]);
  await act(async () => pending[1](reply(0, 4, 0, T2)));
  await act(async () => pending[0](reply(0, 99)));
  expect(badges()).toEqual(['4']);
  await act(async () => window.dispatchEvent(new Event('focus')));
  await act(async () => pending[2](new Response('{}', { status: 500 })));
  expect(badges()).toEqual([]);
  await act(async () => root.render(<Harness shop="another" />));
  expect(badges()).toEqual([]);
  expect(String(fetcher.mock.calls.at(-1)![0])).not.toContain('_since');
  await act(async () => pending[3](reply()));
  expect(JSON.parse(localStorage.getItem(key)!).payments).toBe(T1);
});

it('continues in memory when browser storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply());
  await mount();
  await act(async () => root.render(<Harness />));
  fetcher.mockResolvedValue(reply(0, 3, 0, T2));
  await act(async () => root.render(<Harness revision="refresh" />));
  expect(String(fetcher.mock.calls.at(-1)![0])).toContain('payments_since=');
  expect(badges()).toEqual(['3']);
});
