import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { SellerWorkspace } from './SellerWorkspace';
import { mockOrder } from './courierPostSubmissionTestData';

const page = { total: 1, next_cursor: null, retrieved_at: '2026-11-03T06:00:00Z',
  calendar_date: '2026-11-03', timezone: 'Asia/Dhaka' };

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; localStorage.clear(); });

async function mount() {
  const urls: string[] = [];
  let attentionFails = false;
  let preparationPage = false;
  let delayMore = false;
  let releasePage: (() => void) | undefined;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = String(input); urls.push(url);
    const json = (value: unknown) => new Response(JSON.stringify(value));
    if (url.endsWith('/seller/shop')) return json({ shop: { id: 'shop-1', display_name: 'Test shop' }, setup_needed: false });
    if (url.includes('payment-accounts')) return json([]);
    if (url.includes('/work-queries/attention')) {
      if (attentionFails) return new Response('{}', { status: 503 });
      return json({ ...page, query: 'attention', total: 4, items: [
        { order: { ...mockOrder, id: 'unknown-order' }, category: 'unknown_outcome', reason_codes: ['UNKNOWN_OUTCOME'] },
        { order: { ...mockOrder, id: 'failed-order' }, category: 'failed_submission', reason_codes: ['FAILED_SUBMISSION'] },
        { order: { ...mockOrder, id: 'review-order', lifecycle: 'pending' }, category: 'pending_review', reason_codes: ['PENDING_REVIEW'] },
        { order: { ...mockOrder, id: 'buyer-order', lifecycle: 'awaiting_buyer' }, category: 'awaiting_buyer', reason_codes: ['AWAITING_BUYER_SUBMISSION'] },
      ] });
    }
    if (delayMore && url.includes('/work-queries/preparation') && url.includes('cursor=')) {
      await new Promise<void>(resolve => { releasePage = resolve; });
    }
    if (url.includes('/work-queries/preparation')) return json({ ...page, query: 'preparation',
      total: preparationPage ? 2 : 1,
      next_cursor: preparationPage && !url.includes('cursor=') ? 'page-two' : null,
      items: [{ order: { ...mockOrder, id: url.includes('cursor=') ? 'second-ready-order' : 'ready-order' }, reason_codes: ['AWAITING_COURIER_PREPARATION'] }] });
    if (url.includes('/seller/orders?')) return json({ items: [], next_cursor: null });
    return new Response('{}', { status: 404 });
  });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<LocaleProvider><SellerWorkspace token="seller" /></LocaleProvider>));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="seller-assistant-launcher"]')!.click());
  const send = async (message: string) => {
    const input = host.querySelector<HTMLTextAreaElement>('[name="assistant-message"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, message);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  };
  return { host, root, urls, send, paginate: () => { preparationPage = true; }, delay: () => { delayMore = true; }, release: () => releasePage?.(), fail: (value: boolean) => { attentionFails = value; } };
}

it('keeps successive query cards in the transcript with order navigation and matching dashboard filters', async () => {
  const { host, root, urls, send } = await mount();
  await send('What orders need attention?');
  const attention = host.querySelector<HTMLElement>('[role="log"] .assistant-query-card')!;
  expect(attention).not.toBeNull();
  expect(attention.textContent).toContain('Showing 4 of 4');
  for (const category of ['unknown_outcome', 'failed_submission', 'pending_review', 'awaiting_buyer']) {
    expect(attention.querySelector(`[data-category="${category}"]`)).not.toBeNull();
  }
  await send('What orders are ready for delivery?');
  const cards = host.querySelectorAll<HTMLElement>('[role="log"] .assistant-query-card');
  expect(cards).toHaveLength(2);
  expect(cards[1].textContent).toContain('Showing 1 of 1');
  expect(attention.textContent).toContain('buyer-order');
  const button = (element: Element, text: string) => Array.from(element.querySelectorAll('button')).find(b => b.textContent === text)!;
  await act(async () => button(attention, 'Show in dashboard').click());
  expect(urls.some(url => url.includes('/seller/orders?') && url.includes('work_query=attention'))).toBe(true);
  await act(async () => button(cards[1], 'Show in dashboard').click());
  expect(urls.some(url => url.includes('/seller/orders?') && url.includes('work_query=preparation'))).toBe(true);
  await act(async () => button(cards[1], 'Open order').click());
  expect(document.querySelector('dialog')?.textContent).toContain('ready-order');
  await act(async () => root.unmount());
});

it('shows a recoverable inline query failure without losing the earlier result', async () => {
  const { host, root, send, fail } = await mount();
  await send('What orders are ready for delivery?');
  fail(true);
  await send('What orders need attention?');
  const cards = host.querySelectorAll<HTMLElement>('[role="log"] .assistant-query-card');
  expect(cards[0].textContent).toContain('ready-order');
  expect(cards[1].querySelector('[role="alert"]')).not.toBeNull();
  fail(false);
  const retry = Array.from(cards[1].querySelectorAll('button')).find(b => b.textContent === 'Retry')!;
  await act(async () => retry.click());
  expect(cards[1].textContent).toContain('buyer-order');
  await act(async () => root.unmount());
});

it('preserves loaded query pages across minimize and reopen without fetching again', async () => {
  const { host, root, urls, send, paginate } = await mount();
  paginate();
  await send('What orders are ready for delivery?');
  const more = Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Load more results')!;
  await act(async () => more.click());
  expect(host.textContent).toContain('Showing 2 of 2');
  const calls = urls.filter(url => url.includes('/work-queries/')).length;
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Close assistant"]')!.click());
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="seller-assistant-launcher"]')!.click());
  expect(host.textContent).toContain('Showing 2 of 2');
  expect(host.textContent).toContain('second-ready-order');
  expect(urls.filter(url => url.includes('/work-queries/'))).toHaveLength(calls);
  await act(async () => root.unmount());
});

it('clears saved query data when authorization changes while minimized', async () => {
  const { host, root, send, fail } = await mount();
  await send('What orders need attention?');
  expect(host.textContent).toContain('buyer-order');
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Close assistant"]')!.click());
  fail(true);
  await act(async () => root.render(<LocaleProvider><SellerWorkspace token="another-seller" /></LocaleProvider>));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="seller-assistant-launcher"]')!.click());
  expect(host.textContent).not.toContain('buyer-order');
  await send('What orders need attention?');
  const card = host.querySelector('.assistant-query-card')!;
  expect(card.textContent).not.toContain('buyer-order');
  expect(card.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => root.unmount());
});

it('keeps settled results when minimized during delayed pagination', async () => {
  const { host, root, urls, send, paginate, delay, release } = await mount();
  paginate();
  await send('What orders are ready for delivery?');
  delay();
  const more = Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Load more results')!;
  await act(async () => more.click());
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Close assistant"]')!.click());
  const calls = urls.filter(url => url.includes('/work-queries/')).length;
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="seller-assistant-launcher"]')!.click());
  expect(host.textContent).toContain('Showing 1 of 2');
  expect(host.textContent).toContain('ready-order');
  expect(urls.filter(url => url.includes('/work-queries/'))).toHaveLength(calls);
  expect(Array.from(host.querySelectorAll('button')).some(b => b.textContent === 'Load more results')).toBe(true);
  await act(async () => release());
  await act(async () => root.unmount());
});
