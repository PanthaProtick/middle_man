import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { SellerWorkspace } from './SellerWorkspace';
import {
  deferred, jsonResponse, mount, openPayments, receipt,
  setupWorkspaceFetch, transactionUrls, typeSearch,
} from './transactionSearchTestSupport';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
});

it('clears rows, drops stale inbox responses and keeps search and filter while paging', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const initial = receipt({ id: 'tx-initial', trx_id: 'TRX-INITIAL' });
  const fresh = receipt({ id: 'tx-fresh', trx_id: 'TRX-FRESH' });
  const stale = receipt({ id: 'tx-stale', trx_id: 'TRX-STALE' });
  const pending = new Map<string, ReturnType<typeof deferred>>();

  const urls = setupWorkspaceFetch((url) => {
    const search = url.searchParams.get('search');
    if (!search) {
      if (url.searchParams.get('review')) {
        return jsonResponse({ items: [], next_cursor: null });
      }
      return jsonResponse({ items: [initial], next_cursor: null });
    }
    if (url.searchParams.get('cursor')) {
      return jsonResponse({ items: [receipt({ id: 'tx-page-2', trx_id: 'TRX-PAGE-2' })], next_cursor: null });
    }
    const request = deferred();
    pending.set(search, request);
    return request.promise;
  });

  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await openPayments(host);
  expect(host.textContent).toContain('TRX-INITIAL');

  const filter = host.querySelector<HTMLSelectElement>('#transaction-filter')!;
  expect(filter).toBeTruthy();
  await act(async () => {
    filter.value = 'conflicted';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(host.textContent).not.toContain('TRX-INITIAL');
  expect(host.textContent).toContain('No received transactions match the selected filter.');
  expect(transactionUrls(urls).at(-1)!.searchParams.get('review')).toBe('conflicted');

  const input = host.querySelector<HTMLInputElement>('#transaction-search')!;
  await act(async () => typeSearch(input, 'alpha'));
  expect(host.textContent).not.toContain('TRX-INITIAL');
  expect(host.textContent).toContain('Loading received payments…');
  await act(async () => typeSearch(input, 'alpine'));
  expect([...pending.keys()]).toEqual(['alpha', 'alpine']);

  await act(async () => {
    pending.get('alpine')!.resolve(jsonResponse({ items: [fresh], next_cursor: 'cursor-alpine' }));
  });
  expect(host.textContent).toContain('TRX-FRESH');
  await act(async () => {
    pending.get('alpha')!.resolve(jsonResponse({ items: [stale], next_cursor: null }));
  });
  expect(host.textContent).toContain('TRX-FRESH');
  expect(host.textContent).not.toContain('TRX-STALE');
  expect(window.location.search).toBe('');

  const typed = transactionUrls(urls).filter((url) => url.searchParams.get('search'));
  expect(typed[0].searchParams.get('search')).toBe('alpha');
  expect(typed[1].searchParams.get('search')).toBe('alpine');
  expect(typed[0].searchParams.get('review')).toBe('conflicted');
  expect(typed.every((url) => !url.searchParams.get('cursor'))).toBe(true);

  const loadMore = Array.from(host.querySelectorAll('button')).find(
    (item) => item.textContent?.trim() === 'Load More Received Payments',
  )!;
  await act(async () => loadMore.click());
  const paged = transactionUrls(urls).at(-1)!;
  expect(paged.searchParams.get('cursor')).toBe('cursor-alpine');
  expect(paged.searchParams.get('search')).toBe('alpine');
  expect(paged.searchParams.get('review')).toBe('conflicted');

  await act(async () => {
    host.querySelector<HTMLSelectElement>('#transaction-filter')!.value = 'incomplete';
    host.querySelector<HTMLSelectElement>('#transaction-filter')!
      .dispatchEvent(new Event('change', { bubbles: true }));
  });
  const incomplete = transactionUrls(urls).at(-1)!;
  expect(incomplete.searchParams.get('parse')).toBe('incomplete');
  expect(incomplete.searchParams.get('review')).toBeNull();
  expect(incomplete.searchParams.get('search')).toBe('alpine');
  expect(incomplete.searchParams.get('cursor')).toBeNull();
  await act(async () => root.unmount());
});

it('keeps the typed term and focus when the inbox request fails', async () => {
  localStorage.setItem('middleman.locale', 'en');
  setupWorkspaceFetch((url) => {
    if (url.searchParams.get('search')) return Promise.reject(new Error('offline'));
    return jsonResponse({ items: [], next_cursor: null });
  });

  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await openPayments(host);
  const input = host.querySelector<HTMLInputElement>('#transaction-search')!;
  input.focus();
  await act(async () => typeSearch(input, 'TRX-OFFLINE'));

  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    'Unable to complete this request. Please retry.',
  );
  expect(host.querySelector<HTMLInputElement>('#transaction-search')).toBe(input);
  expect(input.value).toBe('TRX-OFFLINE');
  expect(document.activeElement).toBe(input);
  await act(async () => root.unmount());
});
it('starts a refreshed inbox without the previous search', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const urls = setupWorkspaceFetch(() => jsonResponse({ items: [], next_cursor: null }));
  const first = await mount(<SellerWorkspace token="seller-token" />);
  await openPayments(first.host);
  const input = first.host.querySelector<HTMLInputElement>('#transaction-search')!;
  await act(async () => typeSearch(input, 'TRX-KEPT'));
  expect(transactionUrls(urls).at(-1)!.searchParams.get('search')).toBe('TRX-KEPT');

  await act(async () => first.root.unmount());
  const second = await mount(<SellerWorkspace token="seller-token" />);
  await openPayments(second.host);

  const refreshed = transactionUrls(urls).at(-1)!;
  expect(refreshed.searchParams.get('search')).toBeNull();
  expect(second.host.querySelector<HTMLInputElement>('#transaction-search')!.value).toBe('');
  expect(window.location.search).toBe('');
  await act(async () => second.root.unmount());
});
