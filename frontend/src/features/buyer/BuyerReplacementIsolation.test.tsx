import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BuyerPortal } from './BuyerPortal';
import type { PublicOrder } from './types';

describe('BuyerReplacementIsolation Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockPredecessorCancelled: PublicOrder = {
    id: 'pred-order-uuid-1',
    shop_display_name: 'Test Isolation Shop',
    product_name: 'Original Mechanical Keyboard',
    total_minor: 1200000,
    required_advance_minor: 200000,
    expected_cod_minor: 1000000,
    actual_cod_minor: null,
    account_provider: 'bkash',
    account_receiving_number: '01712345678',
    account_label: 'Shop Primary',
    lifecycle: 'cancelled',
    status_message: 'This order has been cancelled. Please contact the seller.',
    submission_acknowledgement: null,
    created_at: '2026-10-24T12:00:00Z',
    expires_at: '2026-10-26T12:00:00Z',
    completed_at: '2026-10-24T14:00:00Z',
  };

  const mockPredecessorExpired: PublicOrder = {
    ...mockPredecessorCancelled,
    lifecycle: 'expired',
    status_message: 'This order link has expired. Please contact the seller for a new link.',
    completed_at: null,
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders predecessor terminal cancelled view without submission form, redirect, or successor disclosure', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(new Response(JSON.stringify(mockPredecessorCancelled), { status: 200 }))
    );

    // Spy on navigation/location changes
    const assignSpy = vi.fn();
    const replaceSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, assign: assignSpy, replace: replaceSpy, href: 'http://localhost/orders/old-pred-token' },
      configurable: true,
      writable: true,
    });

    await act(async () => {
      root.render(<BuyerPortal portalToken="old-pred-token" />);
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/public/orders/old-pred-token', expect.any(Object));

    // Terminal status is shown prominently in the selected language (English by default).
    expect(container.textContent).toContain('Order Cancelled');
    expect(container.textContent).toContain('Please contact the seller on Facebook/Messenger for further details.');
    expect(container.textContent).toContain('Original Mechanical Keyboard');

    // No submission form or inputs are rendered
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('input[name="buyer_name"]')).toBeNull();
    expect(container.querySelector('input[name="contact_number"]')).toBeNull();
    expect(container.querySelector('input[name="payment_sender"]')).toBeNull();
    expect(container.querySelector('input[name="payment_trx_id"]')).toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();

    // No navigation / redirect took place
    expect(assignSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe('http://localhost/orders/old-pred-token');

    // The view must not contain any hyperlinks pointing to new or replaced orders
    const allLinks = Array.from(container.querySelectorAll('a'));
    expect(allLinks.length).toBe(0);

    // Neither internal order replacement pointers nor successor token metadata exist in rendered HTML
    expect(container.innerHTML).not.toContain('replaced_by_order_id');
    expect(container.innerHTML).not.toContain('portal_token');
  });

  it('renders expired predecessor with terminal expired notice and no action controls', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(new Response(JSON.stringify(mockPredecessorExpired), { status: 200 }))
    );

    await act(async () => {
      root.render(<BuyerPortal portalToken="expired-pred-token" />);
    });

    expect(container.textContent).toContain('Order Link Expired');
    expect(container.textContent).toContain('Please contact the seller for a new link');
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it('shows access denied message when predecessor link is revoked (410 GONE)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: {
              code: 'BUYER_LINK_REVOKED',
              message: 'Buyer link access has been revoked. Contact the seller.',
            },
          }),
          { status: 410 }
        )
      )
    );

    await act(async () => {
      root.render(<BuyerPortal portalToken="revoked-pred-token" />);
    });

    expect(container.textContent).toContain('Order record unavailable. Please contact the seller.');
    expect(container.querySelector('form')).toBeNull();
  });
});
