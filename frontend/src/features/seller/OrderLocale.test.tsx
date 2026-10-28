import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { OrderList } from './OrderList';
import { mockOrder } from './courierPostSubmissionTestData';

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); document.body.innerHTML = ''; });

it('keeps a filter, expanded review and open details while translating labels and Gregorian dates without requests', async () => {
  localStorage.setItem('middleman.locale', 'en');
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.open = false; } });
  const fetcher = vi.spyOn(globalThis, 'fetch');
  const filter = vi.fn(); const loadMore = vi.fn();
  const order = { ...mockOrder, product_name: 'ব্যাগ Bag ১২', account_label: 'নিজের Account',
    lifecycle: 'pending' as const, review_reasons: ['AMOUNT_MISMATCH', 'FUTURE_REASON'],
    created_at: '2026-10-28T01:00:00Z', expires_at: '2026-10-30T01:00:00Z', total_minor: 250025 };
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><OrderList orders={[order]} statusFilter="pending"
    onFilterChange={filter} nextCursor="cursor-original" onLoadMore={loadMore} /></LocaleProvider>));
  const button = (text: string) => Array.from(host.querySelectorAll('button')).find(item => item.textContent?.trim() === text)!;
  expect(host.textContent).toContain('Deadline:');
  expect(host.textContent).not.toContain('BST');
  expect(host.textContent).toContain('Bangladesh time');
  await act(async () => button('Show codes').click());
  await act(async () => button('Inspect').click());
  const dialog = host.querySelector('dialog')!;
  expect(dialog.open).toBe(true);
  const dialogSwitch = Array.from(dialog.querySelectorAll('button')).find(item => item.textContent === 'বাংলা')!;
  dialogSwitch.focus();
  await act(async () => dialogSwitch.click());
  expect(document.activeElement).toBe(dialogSwitch);
  expect(host.textContent).toContain('অর্ডার ও সক্রিয় ক্রেতার লিংক');
  expect(dialog.textContent).toContain('অর্ডার ও লিংকের বিস্তারিত');
  expect(dialog.textContent).toContain('অঙ্ক মিলছে না');
  expect(dialog.textContent).toContain('অজানা');
  expect(dialog.textContent).toContain('অক্টোবর');
  expect(dialog.textContent).toContain('2,500.25');
  expect(dialog.textContent).toContain('ব্যাগ Bag ১২');
  expect(dialog.textContent).toContain('নিজের Account');
  expect(host.querySelector<HTMLSelectElement>('#order-status-filter')!.value).toBe('pending');
  expect(button('কোড লুকান').getAttribute('aria-expanded')).toBe('true');
  expect(fetcher).not.toHaveBeenCalled(); expect(filter).not.toHaveBeenCalled();
  await act(async () => button('আরও অর্ডার দেখুন').click()); expect(loadMore).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});
it.each(['en', 'bn'] as const)('shows an empty list and safe unknown lifecycle guidance in %s without changing filter values', async locale => {
  localStorage.setItem('middleman.locale', locale);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const change = vi.fn();
  const render = (orders: typeof mockOrder[]) => <LocaleProvider><LocaleSwitch /><OrderList orders={orders}
    statusFilter="confirmed" onFilterChange={change} nextCursor={null} onLoadMore={vi.fn()} /></LocaleProvider>;
  await act(async () => root.render(render([])));
  expect(host.textContent).toContain(locale === 'bn' ? 'কোনো অর্ডার পাওয়া যায়নি' : 'No orders found');
  const unknown: typeof mockOrder = JSON.parse(JSON.stringify({ ...mockOrder, lifecycle: 'future_state', product_name: 'Original ১২' }));
  await act(async () => root.render(render([unknown])));
  expect(host.textContent).toContain(locale === 'bn' ? 'অজানা অবস্থা' : 'Unknown status');
  expect(host.textContent).not.toContain('future_state');
  const select = host.querySelector<HTMLSelectElement>('#order-status-filter')!;
  await act(async () => { select.value = 'awaiting_buyer'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(change).toHaveBeenCalledWith('awaiting_buyer');
  await act(async () => root.unmount());
});
