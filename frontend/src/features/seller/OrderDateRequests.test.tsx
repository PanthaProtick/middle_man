import { act } from 'react';
import { expect, it } from 'vitest';
import { SellerWorkspace } from './SellerWorkspace';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { lastDaysRange } from './orderDateFilter';
import { setupFetch, mount, listUrls, selectMode, setInput, input, button, order, jsonResponse } from './orderDatesTestSupport';

it('reuses the captured relative boundaries for load more and CSV export', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const urls = setupFetch(undefined, { nextCursor: 'cursor-1' });
  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await selectMode(host, 'relative');
  await act(async () => button(host, 'Last 7 days').click());
  const expected = lastDaysRange(7);
  const first = listUrls(urls).at(-1)!;
  expect(first).toContain(`from_date=${expected.from}`);
  expect(first).toContain(`to_date=${expected.to}`);
  expect(button(host, 'Download filtered English CSV')).toBeTruthy();

  await act(async () => button(host, 'Load More Orders').click());
  const paged = listUrls(urls).at(-1)!;
  expect(paged).toContain('cursor=cursor-1');
  expect(paged).toContain(`from_date=${expected.from}`);
  expect(paged).toContain(`to_date=${expected.to}`);

  await act(async () => button(host, 'Download filtered English CSV').click());
  const exported = urls.at(-1)!;
  expect(exported).toContain('/api/seller/orders/export?');
  expect(exported).toContain(`from_date=${expected.from}`);
  expect(exported).toContain(`to_date=${expected.to}`);
  await act(async () => root.unmount());
});

it('drops a stale date response after a newer range is applied', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const fresh = order({ id: 'fresh', product_name: 'Fresh Range Result' });
  const stale = order({ id: 'stale', product_name: 'Stale Range Result' });
  const pending = new Map<string, { promise: Promise<Response>; resolve: (value: Response) => void }>();
  const urls = setupFetch((url) => {
    const from = url.searchParams.get('from_date');
    if (!from) {
      return jsonResponse({ items: [order({ id: 'initial', product_name: 'Initial Order' })], next_cursor: null });
    }
    let resolve: (value: Response) => void = () => undefined;
    const promise = new Promise<Response>((done) => { resolve = done; });
    pending.set(from, { promise, resolve });
    return promise;
  });

  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await selectMode(host, 'custom');
  await setInput(input(host, 'order-date-from'), '2026-10-01');
  await setInput(input(host, 'order-date-to'), '2026-10-28');
  await act(async () => button(host, 'Apply dates').click());
  await setInput(input(host, 'order-date-from'), '2026-10-02');
  await act(async () => button(host, 'Apply dates').click());
  expect([...pending.keys()]).toEqual(['2026-10-01', '2026-10-02']);

  await act(async () => {
    pending.get('2026-10-02')!.resolve(jsonResponse({ items: [fresh], next_cursor: null }));
  });
  expect(host.textContent).toContain('Fresh Range Result');
  await act(async () => {
    pending.get('2026-10-01')!.resolve(jsonResponse({ items: [stale], next_cursor: null }));
  });
  expect(host.textContent).toContain('Fresh Range Result');
  expect(host.textContent).not.toContain('Stale Range Result');
  expect(urls.some((url) => url.includes('cursor='))).toBe(false);
  await act(async () => root.unmount());
});

it('preserves selected dates and the active range across a language switch without refetching', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const urls = setupFetch();
  const { host, root } = await mount(
    <LocaleProvider><LocaleSwitch /><SellerWorkspace token="seller-token" /></LocaleProvider>,
  );
  await selectMode(host, 'custom');
  const from = input(host, 'order-date-from');
  await setInput(from, '2026-10-01');
  await setInput(input(host, 'order-date-to'), '2026-10-28');
  await act(async () => button(host, 'Apply dates').click());
  const before = urls.length;

  const bengali = Array.from(host.querySelectorAll('button')).find(
    (item) => item.textContent?.trim() === 'বাংলা',
  )!;
  await act(async () => bengali.click());

  expect(urls).toHaveLength(before);
  expect(input(host, 'order-date-from')).toBe(from);
  expect(from.value).toBe('2026-10-01');
  expect(input(host, 'order-date-to').value).toBe('2026-10-28');
  expect(host.querySelector<HTMLSelectElement>('#order-date-mode')!.value).toBe('custom');
  expect(host.textContent).toContain('তারিখ:');
  expect(host.textContent).toContain('2026-10-01 থেকে 2026-10-28');
  await act(async () => root.unmount());
});

it('uses the distinct no-match message when only a date range is active', async () => {
  localStorage.setItem('middleman.locale', 'en');
  setupFetch((url) => {
    if (url.searchParams.get('from_date')) {
      return jsonResponse({ items: [], next_cursor: null });
    }
    return jsonResponse({
      items: [order({ id: 'initial', product_name: 'Initial Order' })],
      next_cursor: null,
    });
  });
  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await selectMode(host, 'custom');
  await setInput(input(host, 'order-date-from'), '2026-10-01');
  await setInput(input(host, 'order-date-to'), '2026-10-28');
  await act(async () => button(host, 'Apply dates').click());

  expect(host.textContent).toContain('No orders match this date range.');
  expect(host.textContent).not.toContain('No orders match this search and filter.');
  await act(async () => root.unmount());
});
