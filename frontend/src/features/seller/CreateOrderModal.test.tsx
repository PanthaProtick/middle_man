import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { CreateOrderModal } from './CreateOrderModal';
import type { PaymentAccount, SellerOrder } from './types';

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('CreateOrderModal Component', () => {
  let container: HTMLDivElement;

  const mockAccounts: PaymentAccount[] = [
    {
      id: 'acc-1',
      shop_id: 's1',
      provider: 'bkash',
      receiving_number: '01711223344',
      label: 'Main bKash',
      is_active: true,
      version: 1,
      created_at: '',
      updated_at: '',
    },
    {
      id: 'acc-inactive',
      shop_id: 's1',
      provider: 'nagad',
      receiving_number: '01811223344',
      label: 'Inactive Nagad',
      is_active: false,
      version: 1,
      created_at: '',
      updated_at: '',
    },
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.restoreAllMocks();
  });

  it('renders modal with active account selected and shows expected COD', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(CreateOrderModal, {
          accounts: mockAccounts,
          token: 'test-tok',
          onClose: vi.fn(),
          onOrderCreated: vi.fn(),
          onError: vi.fn(),
        }),
      );
    });

    expect(container.textContent).toContain('Create Order & Buyer Link');
    expect(container.textContent).toContain('Expected Remaining COD:');
    const select = container.querySelector('select[name="paymentAccountId"]') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.options.length).toBe(1);
    expect(select.options[0].text).toContain('Main bKash');
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(container.querySelector('input[name="productName"]'));
  });

  it('closes with Escape when it is not submitting', async () => {
    const onClose = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(CreateOrderModal, {
          accounts: mockAccounts,
          onClose,
          onOrderCreated: vi.fn(),
          onError: vi.fn(),
        }),
      );
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });

  it('validates required advance cannot exceed total', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(CreateOrderModal, {
          accounts: mockAccounts,
          token: 'test-tok',
          onClose: vi.fn(),
          onOrderCreated: vi.fn(),
          onError: vi.fn(),
        }),
      );
    });

    const productInput = container.querySelector('input[name="productName"]') as HTMLInputElement;
    const totalInput = container.querySelector('input[name="totalBdt"]') as HTMLInputElement;
    const advanceInput = container.querySelector('input[name="advanceBdt"]') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      setInputValue(productInput, 'Premium Headset');
      setInputValue(totalInput, '1000');
      setInputValue(advanceInput, '1500'); // advance > total!
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain('Required delivery advance cannot exceed order total');
  });

  it('submits valid order and invokes onOrderCreated callback', async () => {
    const onOrderCreated = vi.fn();
    const onClose = vi.fn();

    const mockCreatedOrder: SellerOrder = {
      id: 'ord-new',
      shop_id: 's1',
      payment_account_id: 'acc-1',
      product_name: 'Cotton Panjabi',
      total_minor: 220000,
      required_advance_minor: 30000,
      expected_cod_minor: 190000,
      actual_cod_minor: null,
      account_provider: 'bkash',
      account_receiving_number: '01711223344',
      account_label: 'Main bKash',
      lifecycle: 'awaiting_buyer',
      version: 1,
      review_reasons: [],
      buyer_revision: null,
      allocation_basis: null,
      portal_token: 'token-xyz',
      portal_url: '/orders/token-xyz',
      created_at: '2026-10-23T12:00:00Z',
      updated_at: '2026-10-23T12:00:00Z',
      expires_at: '2026-10-25T12:00:00Z',
      completed_at: null,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockCreatedOrder), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(CreateOrderModal, {
          accounts: mockAccounts,
          token: 'test-tok',
          onClose,
          onOrderCreated,
          onError: vi.fn(),
        }),
      );
    });

    const productInput = container.querySelector('input[name="productName"]') as HTMLInputElement;
    const totalInput = container.querySelector('input[name="totalBdt"]') as HTMLInputElement;
    const advanceInput = container.querySelector('input[name="advanceBdt"]') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await act(async () => {
      setInputValue(productInput, 'Cotton Panjabi');
      setInputValue(totalInput, '2200');
      setInputValue(advanceInput, '300');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(onOrderCreated).toHaveBeenCalledWith(mockCreatedOrder);
    expect(onClose).toHaveBeenCalled();
  });
});
