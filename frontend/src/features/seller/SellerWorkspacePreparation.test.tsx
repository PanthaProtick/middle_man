import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { SellerWorkspace } from './SellerWorkspace';

const preview = {
  query: 'preparation',
  items: [], total: 0, next_cursor: null,
  retrieved_at: '2026-11-01T06:00:00Z', calendar_date: '2026-11-01', timezone: 'Asia/Dhaka',
};

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  localStorage.clear();
});

it('switches to the order dashboard with the shared query and keeps an unfinished draft', async () => {
  const urls: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = String(input);
    urls.push(url);
    if (url.endsWith('/seller/shop')) {
      return new Response(JSON.stringify({ shop: { id: 'shop-1', display_name: 'Test shop' }, setup_needed: false }));
    }
    if (url.includes('payment-accounts')) return new Response(JSON.stringify([]));
    if (url.includes('/work-queries/preparation')) return new Response(JSON.stringify(preview));
    return new Response(JSON.stringify({ items: [], next_cursor: null }));
  });

  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<LocaleProvider><SellerWorkspace token="seller" /></LocaleProvider>));
  await act(async () => { await Promise.resolve(); });

  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="seller-assistant-launcher"]')!.click());
  const choices = () => Array.from(host.querySelectorAll<HTMLButtonElement>('.assistant-workflow-choices button'));
  await act(async () => choices()[0].click());
  expect(host.querySelector('[name="assistant-draft"]')).not.toBeNull();

  const preparation = choices().find(button => button.textContent === 'Awaiting delivery preparation')!;
  await act(async () => preparation.click());
  await act(async () => { await Promise.resolve(); });

  const show = Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Show in dashboard')!;
  await act(async () => show.click());
  await act(async () => { await Promise.resolve(); });

  expect(urls.some(url => url.includes('/seller/orders?') && url.includes('work_query=preparation'))).toBe(true);
  expect(host.querySelector('.assistant-draft-status')).not.toBeNull();
  expect(host.textContent).toContain('shared delivery-preparation query');

  await act(async () => root.unmount());
});
