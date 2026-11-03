import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { SellerWorkspace } from './SellerWorkspace';

// Fetch is the external API seam; all workspace components run together.
afterEach(() => {
  vi.restoreAllMocks(); localStorage.clear(); document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
});

it('keeps payment navigation, receiving-account selection and guided entry available', async () => {
  localStorage.setItem('middleman.locale', 'en');
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const path = new URL(String(input), 'http://localhost').pathname;
    const body = path === '/api/seller/shop'
      ? { shop: { id: 'shop-1', owner_id: 'seller-1', display_name: 'Payment Shop', created_at: '', updated_at: '' }, setup_needed: false }
      : path === '/api/seller/payment-accounts'
        ? [{ id: 'account-1', shop_id: 'shop-1', provider: 'bkash', receiving_number: '01711223344', label: 'Shop account', is_active: true, version: 1, created_at: '', updated_at: '' }]
        : { items: [], next_cursor: null };
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const button = (label: string) => {
    const found = Array.from(document.querySelectorAll('button')).find(item => item.textContent?.trim() === label);
    if (!found) throw new Error(`Missing button: ${label}`);
    return found;
  };
  try {
    await act(async () => root.render(<LocaleProvider><SellerWorkspace token="seller" /></LocaleProvider>));
    await act(async () => button('Payments').click());
    expect(host.textContent).not.toMatch(/SMS|Previous import results/);
    expect(host.textContent).toContain('Received Payments Inbox');
    await act(async () => button('Record Payment').click());
    const dialog = document.querySelector('[role="dialog"][aria-label="Record Received Payment"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.querySelector<HTMLSelectElement>('#manual-accountId')!.value).toBe('account-1');
    expect(dialog!.textContent).toContain('Shop account');
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    await act(async () => button('AI Assistant').click());
    expect(document.body.textContent).toContain('Choose a workflow or tell me what you need.');
    await act(async () => button('Record a payment').click());
    expect(document.body.textContent).toContain('Record a payment');
    expect(document.querySelector('textarea')).not.toBeNull();
  } finally { await act(async () => root.unmount()); }
});
