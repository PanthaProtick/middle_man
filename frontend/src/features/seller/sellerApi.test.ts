import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchShop,
  createShop,
  fetchOrders,
  createOrder,
  resolveOrderLink,
  canonicalizeBdPhone,
  formatBangladeshTime,
} from './api';
import type { SellerOrder } from './types';

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

  it('formats dates in Bangladesh time with explicit zone', () => {
    const formatted = formatBangladeshTime('2026-10-24T12:00:00Z');
    expect(formatted).toContain('Bangladesh time');
    expect(formatted).toContain('2026');
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
      new Response(JSON.stringify(mockResponse), { status: 200, headers: { 'Content-Type': 'application/json' } }),
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
      new Response(JSON.stringify(mockResponse), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    );

    const res = await createShop('New Shop', 'key-123', 'test-token');
    expect(res.shop?.display_name).toBe('New Shop');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/seller\/shop$/),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': 'key-123',
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('fetchOrders, createOrder, and resolveOrderLink invoke respective endpoints', async () => {
    const mockOrder: SellerOrder = {
      id: 'ord-123',
      shop_id: 's1',
      payment_account_id: 'acc-1',
      product_name: 'Smart Watch',
      total_minor: 300000,
      required_advance_minor: 50000,
      expected_cod_minor: 250000,
      actual_cod_minor: null,
      account_provider: 'bkash',
      account_receiving_number: '01711223344',
      account_label: 'Main bKash',
      lifecycle: 'awaiting_buyer',
      version: 1,
      review_reasons: [],
      buyer_revision: null,
      allocation_basis: null,
      portal_token: 'tok-abc-123',
      portal_url: '/orders/tok-abc-123',
      created_at: '2026-10-23T10:00:00Z',
      updated_at: '2026-10-23T10:00:00Z',
      expires_at: '2026-10-25T10:00:00Z',
      completed_at: null,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      const urlStr = String(url);
      if (urlStr.includes('/seller/orders') && init?.method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify(mockOrder), { status: 201 }));
      }
      if (urlStr.includes('/seller/orders')) {
        return Promise.resolve(new Response(JSON.stringify({ items: [mockOrder], next_cursor: null }), { status: 200 }));
      }
      if (urlStr.includes('/seller/order-links/resolve')) {
        return Promise.resolve(new Response(JSON.stringify({ order_id: 'ord-123' }), { status: 200 }));
      }
      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });

    const listRes = await fetchOrders({ status: 'awaiting_buyer' }, 'tok');
    expect(listRes.items.length).toBe(1);
    expect(listRes.items[0].product_name).toBe('Smart Watch');

    const created = await createOrder(
      { product_name: 'Smart Watch', total_minor: 300000, required_advance_minor: 50000, payment_account_id: 'acc-1' },
      'idem-key-99',
      'tok',
    );
    expect(created.id).toBe('ord-123');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/seller\/orders$/),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': 'idem-key-99' }),
      }),
    );

    const resolved = await resolveOrderLink('tok-abc-123', 'tok');
    expect(resolved.order_id).toBe('ord-123');
  });
});
