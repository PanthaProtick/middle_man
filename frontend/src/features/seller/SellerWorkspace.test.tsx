import type { SellerOrder } from './types';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { SellerWorkspace } from './SellerWorkspace';

describe('SellerWorkspace Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders setup form when shop setup is needed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ shop: null, setup_needed: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(SellerWorkspace, { token: 'mock-seller-token' }));
    });

    expect(container.textContent).toContain('Shop Setup');
    expect(container.querySelector('input[name="displayName"]')).not.toBeNull();
  });

  it('renders accounts list and orders list when shop exists and inspects order', async () => {
    const mockOrder: SellerOrder = {
      id: 'ord-1',
      shop_id: 's1',
      payment_account_id: 'acc-1',
      product_name: 'Wireless Earbuds',
      total_minor: 250000,
      required_advance_minor: 50000,
      expected_cod_minor: 200000,
      actual_cod_minor: null,
      account_provider: 'bkash',
      account_receiving_number: '01711223344',
      account_label: 'Personal bKash',
      lifecycle: 'awaiting_buyer',
      version: 1,
      review_reasons: [],
      buyer_revision: null,
      allocation_basis: null,
      portal_token: 'portal-tok-1',
      portal_url: '/orders/portal-tok-1',
      created_at: '2026-10-23T12:00:00Z',
      updated_at: '2026-10-23T12:00:00Z',
      expires_at: '2026-10-25T12:00:00Z',
      completed_at: null,
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/seller/shop')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              shop: { id: 's1', owner_id: 'o1', display_name: 'Active Shop', created_at: '', updated_at: '' },
              setup_needed: false,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (urlStr.includes('/seller/payment-accounts')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 'acc-1',
                shop_id: 's1',
                provider: 'bkash',
                receiving_number: '01711223344',
                label: 'Personal bKash',
                is_active: true,
                version: 1,
                created_at: '',
                updated_at: '',
              },
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (urlStr.includes('/seller/orders')) {
        return Promise.resolve(
          new Response(JSON.stringify({ items: [mockOrder], next_cursor: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(SellerWorkspace, { token: 'mock-seller-token' }));
    });

    expect(container.textContent).toContain('Active Shop');
    expect(container.textContent).toContain('Personal bKash');
    expect(container.textContent).toContain('Wireless Earbuds');
    expect(container.textContent).toContain('Expected remaining COD balance:');
    expect(container.textContent).toContain('BDT 2,000');
    expect(container.textContent).toContain('Awaiting Buyer');
    expect(container.textContent).toContain('Create Order Link');
    expect(container.textContent).toContain('Inspect');
    expect(container.textContent).toContain('Copy Link');

    // Click "Inspect" button to open OrderDetailModal
    const inspectBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Inspect'),
    );
    expect(inspectBtn).toBeDefined();
    await act(async () => {
      inspectBtn?.click();
    });

    expect(container.textContent).toContain('Order & Link Details');
    expect(container.textContent).toContain('Fixed Receiving Account Snapshot');
    expect(container.textContent).toContain('Copy Buyer Link');
  });

  it('renders explicit error and retry state when initial shop load fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(SellerWorkspace, { token: 'mock-seller-token' }));
    });

    expect(container.textContent).toContain('Workspace Error');
    expect(container.textContent).toContain('Unable to complete this request. Please retry.');
    expect(container.textContent).not.toContain('Network offline');
    expect(container.textContent).toContain('Retry');
  });

  it('renders unauthenticated sign-in prompt and does not fetch when token is not provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(SellerWorkspace, {}));
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Sign in');
    expect(container.textContent).not.toContain('Active Shop');
  });

  it('triggers onSignIn callback when Sign in button is clicked, and clears data on sign out', async () => {
    const mockOrder: SellerOrder = {
      id: 'ord-123',
      shop_id: 's1',
      payment_account_id: 'acc-1',
      product_name: 'Wireless Earbuds',
      total_minor: 250000,
      required_advance_minor: 50000,
      expected_cod_minor: 200000,
      actual_cod_minor: null,
      account_provider: 'bkash',
      account_receiving_number: '01711223344',
      account_label: 'Personal bKash',
      lifecycle: 'awaiting_buyer',
      version: 1,
      review_reasons: [],
      buyer_revision: null,
      allocation_basis: null,
      portal_token: 'tok-xyz-456',
      portal_url: '/orders/tok-xyz-456',
      created_at: '2026-10-24T12:00:00Z',
      updated_at: '2026-10-24T12:00:00Z',
      expires_at: '2026-10-26T12:00:00Z',
      completed_at: null,
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const urlStr = typeof input === 'string' ? input : input.toString();
      if (urlStr.includes('/seller/shop')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              shop: { id: 's1', owner_id: 'o1', display_name: 'Active Shop', created_at: '', updated_at: '' },
              setup_needed: false,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (urlStr.includes('/seller/payment-accounts')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 'acc-1',
                shop_id: 's1',
                provider: 'bkash',
                receiving_number: '01711223344',
                label: 'Personal bKash',
                is_active: true,
                version: 1,
                created_at: '',
                updated_at: '',
              },
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (urlStr.includes('/seller/orders')) {
        return Promise.resolve(
          new Response(JSON.stringify({ items: [mockOrder], next_cursor: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });

    const onSignIn = vi.fn();
    const root = createRoot(container);

    // 1. Initially unauthenticated
    await act(async () => {
      root.render(React.createElement(SellerWorkspace, { token: undefined, onSignIn }));
    });
    expect(container.textContent).toContain('Sign in to your shop');

    const signInBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Sign in'),
    );
    expect(signInBtn).toBeDefined();
    await act(async () => {
      signInBtn?.click();
    });
    expect(onSignIn).toHaveBeenCalledWith();

    // 2. Sign in with token
    await act(async () => {
      root.render(React.createElement(SellerWorkspace, { token: 'valid-test-token', onSignIn }));
    });
    expect(container.textContent).toContain('Active Shop');

    // 3. Sign out (token becomes undefined) -> private data cleared
    await act(async () => {
      root.render(React.createElement(SellerWorkspace, { token: undefined, onSignIn }));
    });
    expect(container.textContent).not.toContain('Active Shop');
    expect(container.textContent).toContain('Sign in to your shop');
  });
});


