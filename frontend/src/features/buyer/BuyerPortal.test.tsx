import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BuyerPortal } from './BuyerPortal';
import type { PublicOrder } from './types';

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    input instanceof HTMLInputElement ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype,
    'value'
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('BuyerPortal Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  const mockPublicOrderAwaiting: PublicOrder = {
    id: 'order-uuid-1',
    shop_display_name: 'Smart Gadget Shop',
    product_name: 'Wireless Bluetooth Earbuds',
    total_minor: 350000,
    required_advance_minor: 50000,
    expected_cod_minor: 300000,
    actual_cod_minor: null,
    account_provider: 'bkash',
    account_receiving_number: '01712345678',
    account_label: 'Shop Official bKash',
    lifecycle: 'awaiting_buyer',
    status_message: 'Please review and submit payment details.',
    submission_acknowledgement: null,
    created_at: '2026-10-23T12:00:00Z',
    expires_at: '2026-10-25T12:00:00Z',
    completed_at: null,
    ai_assistance_available: false,
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

  it('renders loading state initially then displays public order details and form', async () => {
    const fetchOrder = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(new Response(JSON.stringify(mockPublicOrderAwaiting), { status: 200 }))
    );

    await act(async () => {
      root.render(<BuyerPortal portalToken="mock-token-123" />);
    });

    expect(container.textContent).toContain('Smart Gadget Shop');
    expect(container.textContent).toContain('Wireless Bluetooth Earbuds');
    expect(fetchOrder).toHaveBeenCalledWith('/api/public/orders/mock-token-123', expect.objectContaining({
      method: 'GET', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
    }));
    expect(container.textContent).toContain('01712345678');
    expect(container.textContent).toContain('৳500.00'); // Advance
    expect(container.textContent).toContain('৳3,000.00'); // Expected COD

    // Check separate contact and payment sender fields are present
    expect(container.textContent).toContain('AI assistance is unavailable');
    expect(container.querySelector('[aria-label="Optional address assistance"]')).toBeNull();
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
    expect(container.querySelector('input[name="contact_number"]')).not.toBeNull();
    expect(container.querySelector('input[name="payment_sender"]')).not.toBeNull();
  });

  it('copies receiving account number to clipboard when copy button is clicked', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(new Response(JSON.stringify(mockPublicOrderAwaiting), { status: 200 }))
    );

    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWriteText },
      configurable: true,
      writable: true,
    });

    await act(async () => {
      root.render(<BuyerPortal portalToken="mock-token-123" />);
    });

    const copyBtn = container.querySelector('[data-testid="copy-receiving-btn"]') as HTMLButtonElement;
    expect(copyBtn).not.toBeNull();

    await act(async () => {
      copyBtn.click();
    });

    expect(clipboardWriteText).toHaveBeenCalledWith('01712345678');
    expect(copyBtn.textContent).toContain('Copied');
  });

  it('submits valid form with different contact and sender, and transitions to pending view', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() =>
        Promise.resolve(new Response(JSON.stringify(mockPublicOrderAwaiting), { status: 200 }))
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              ...mockPublicOrderAwaiting,
              lifecycle: 'pending',
              status_message: 'Your submission has been received and is pending seller review.',
              submission_acknowledgement: 'ACK-ORDER-1',
            }),
            { status: 200 }
          )
        )
      );

    await act(async () => {
      root.render(<BuyerPortal portalToken="mock-token-123" />);
    });

    const nameInput = container.querySelector('input[name="buyer_name"]') as HTMLInputElement;
    const contactInput = container.querySelector('input[name="contact_number"]') as HTMLInputElement;
    const addressInput = container.querySelector('textarea[name="address_raw"]') as HTMLTextAreaElement;
    const senderInput = container.querySelector('input[name="payment_sender"]') as HTMLInputElement;
    const trxInput = container.querySelector('input[name="payment_trx_id"]') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      setInputValue(nameInput, 'Kamal Hossain');
      setInputValue(contactInput, '০১৭১১২২৩৩৪৪'); // Bangla digits
      setInputValue(addressInput, 'House 5, Road 2, Gulshan, Dhaka');
      setInputValue(senderInput, '+880 1822334455'); // Different sender
      setInputValue(trxInput, 'BK123456');
    });

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    // Should now show pending status and acknowledgement
    expect(container.textContent).toContain('ACK-ORDER-1');
    expect(container.textContent).toContain('Pending Seller Review');
    expect(container.textContent).toContain('৳3,000.00'); // Expected COD preserved
  });

  it('handles public policy gate 503 error gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: {
              code: 'PUBLIC_ACCESS_POLICY_UNSETTLED',
              message: 'Public buyer access is disabled until access/projection policy is settled',
            },
          }),
          { status: 503 }
        )
      )
    );

    await act(async () => {
      root.render(<BuyerPortal portalToken="mock-token-123" />);
    });

    expect(container.textContent).toContain('Public Access Disabled');
    expect(container.textContent).toContain('Public buyer access is disabled until access/projection policy is settled');
  });

  it('offers retry for a database outage without labelling it a policy denial', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Unable to load order. Please retry.' },
    }), { status: 503 }));
    await act(async () => root.render(<BuyerPortal portalToken="synthetic" />));
    expect(container.textContent).not.toContain('Public Access Disabled');
    expect(container.querySelector('button')?.textContent).toContain('Retry');
    expect(container.textContent).toContain('Unable to load order. Please retry.');
  });

  it('displays confirmed order status immediately with actual COD balance', async () => {
    const mockConfirmedOrder: PublicOrder = {
      ...mockPublicOrderAwaiting,
      lifecycle: 'confirmed',
      actual_cod_minor: 300000,
      expected_cod_minor: 300000,
      status_message: 'Your order has been confirmed by the seller.',
      submission_acknowledgement: 'ACK-ORDER-1',
      completed_at: '2026-10-24T10:05:00Z',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockConfirmedOrder), { status: 200 })
    );

    await act(async () => {
      root.render(<BuyerPortal portalToken="mock-token-confirmed" />);
    });

    expect(container.textContent).toContain('Order Confirmed');
    expect(container.textContent).toContain('Remaining COD');
    expect(container.textContent).toContain('৳3,000.00');
    expect(container.textContent).toContain('ACK-ORDER-1');
  });
});
