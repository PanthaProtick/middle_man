import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { SellerWorkspace } from './SellerWorkspace';
import {
  fetchShop,
  createShop,
  canonicalizeBdPhone,
} from './api';

describe('Seller API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('canonicalizes Bangladeshi phone numbers and converts Bangla digits', () => {
    expect(canonicalizeBdPhone('০১৭১১২২৩৩৪৪')).toBe('01711223344');
    expect(canonicalizeBdPhone('+8801811223344')).toBe('01811223344');
    expect(canonicalizeBdPhone('8801911223344')).toBe('01911223344');
    expect(canonicalizeBdPhone(' 01711-223344 ')).toBe('01711223344');
    expect(() => canonicalizeBdPhone('12345')).toThrow();
  });

  it('fetchShop returns shop status when backend responds', async () => {
    const mockResponse = {
      shop: {
        id: 'shop-1',
        owner_id: 'seller-1',
        display_name: "Pantha's Shop",
        created_at: '2026-10-23T00:00:00Z',
        updated_at: '2026-10-23T00:00:00Z',
      },
      setup_needed: false,
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const res = await fetchShop('test-token');
    expect(res.setup_needed).toBe(false);
    expect(res.shop?.display_name).toBe("Pantha's Shop");
  });

  it('createShop sends Idempotency-Key header and returns created shop', async () => {
    const mockResponse = {
      shop: {
        id: 'shop-1',
        owner_id: 'seller-1',
        display_name: 'New Shop',
        created_at: '2026-10-23T00:00:00Z',
        updated_at: '2026-10-23T00:00:00Z',
      },
      setup_needed: false,
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 201, headers: { 'Content-Type': 'application/json' } })
    );

    const res = await createShop('New Shop', 'key-123', 'test-token');
    expect(res.shop?.display_name).toBe('New Shop');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/seller\/shop$/),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': 'key-123',
          'Authorization': 'Bearer test-token',
        }),
      })
    );
  });
});

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
      })
    );

    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(SellerWorkspace, { token: 'mock-seller-token' }));
    });

    expect(container.textContent).toContain('Shop Setup');
    expect(container.querySelector('input[name="displayName"]')).not.toBeNull();
  });

  it('renders accounts list and add-account form when shop exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const urlStr = String(url);
      if (urlStr.includes('/seller/shop')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              shop: { id: 's1', owner_id: 'o1', display_name: 'Active Shop', created_at: '', updated_at: '' },
              setup_needed: false,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
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
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
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
    expect(container.textContent).toContain('01711223344');
  });

  it('renders explicit error and retry state when initial shop load fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(SellerWorkspace, { token: 'mock-seller-token' }));
    });

    expect(container.textContent).toContain('Workspace Error');
    expect(container.textContent).toContain('Network offline');
    expect(container.textContent).toContain('Retry');
  });
});
