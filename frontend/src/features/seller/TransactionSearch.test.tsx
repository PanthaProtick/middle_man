import { act, useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { fetchTransactions } from './api';
import { TransactionInbox } from './TransactionInbox';
import { jsonResponse, mount, typeSearch } from './transactionSearchTestSupport';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
});

it('sends one trimmed search term with the reconciliation filter and cursor', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve(jsonResponse({ items: [], next_cursor: null })),
  );
  await fetchTransactions(
    { review: 'conflicted', search: '  TRX-99 ', cursor: 'cursor-1' },
    'token',
  );
  const url = String(fetcher.mock.calls[0][0]);
  expect(url).toContain('/api/seller/transactions?');
  expect(url).toContain('cursor=cursor-1');
  expect(url).toContain('review=conflicted');
  expect(url).toContain('search=TRX-99');
  expect(window.location.search).toBe('');

  await fetchTransactions({ search: '   ', parse: 'incomplete' }, 'token');
  expect(String(fetcher.mock.calls[1][0])).toBe('/api/seller/transactions?parse=incomplete');
});

it('renders accessible search guidance and preserves the term across a language switch', async () => {
  localStorage.setItem('middleman.locale', 'en');
  function Harness(): React.JSX.Element {
    const [search, setSearch] = useState('');
    return (
      <TransactionInbox
        transactions={[]}
        filter=""
        onFilterChange={() => undefined}
        search={search}
        onSearchChange={setSearch}
      />
    );
  }
  const fetcher = vi.spyOn(globalThis, 'fetch');
  const { host, root } = await mount(
    <LocaleProvider><LocaleSwitch /><Harness /></LocaleProvider>,
  );
  const input = host.querySelector<HTMLInputElement>('#transaction-search')!;
  expect(input).toBeTruthy();
  expect(host.querySelector('label[for="transaction-search"]')?.textContent).toBe(
    'Search received payments',
  );
  expect(host.querySelector('[role="search"]')).toBeTruthy();

  input.focus();
  await act(async () => typeSearch(input, 'TRX ১২৩'));
  expect(input.value).toBe('TRX ১২৩');
  expect(host.textContent).toContain('No received payments match this search and filter.');
  expect(document.activeElement).toBe(input);

  const clear = host.querySelector<HTMLButtonElement>('button[aria-label="Clear search"]')!;
  expect(clear).toBeTruthy();
  await act(async () => clear.click());
  expect(input.value).toBe('');
  expect(host.textContent).toContain('No received payments recorded yet.');

  await act(async () => typeSearch(input, 'TRX ১২৩'));
  const bengali = Array.from(host.querySelectorAll('button')).find(
    (item) => item.textContent === 'বাংলা',
  )!;
  await act(async () => bengali.click());

  expect(host.querySelector('#transaction-search')).toBe(input);
  expect(input.value).toBe('TRX ১২৩');
  expect(host.textContent).toContain('প্রাপ্ত পেমেন্ট খুঁজুন');
  expect(host.textContent).toContain('এই অনুসন্ধান ও ফিল্টারে কোনো প্রাপ্ত পেমেন্ট মেলেনি।');
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});
