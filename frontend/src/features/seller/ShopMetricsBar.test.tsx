import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ShopMetricsBar } from './ShopMetricsBar';
import type { SellerOrder } from './types';

describe('ShopMetricsBar Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders correct counts for total, confirmed, awaiting, and pending review', async () => {
    const mockOrders: SellerOrder[] = [
      {
        id: 'ord-1',
        shop_id: 's1',
        payment_account_id: 'acc-1',
        product_name: 'Product 1',
        total_minor: 100000,
        required_advance_minor: 20000,
        expected_cod_minor: 80000,
        actual_cod_minor: null,
        account_provider: 'bkash',
        account_receiving_number: '01711223344',
        account_label: 'bKash',
        lifecycle: 'confirmed',
        version: 1,
        review_reasons: [],
        buyer_revision: null,
        allocation_basis: null,
        portal_token: 'tok-1',
        portal_url: '/orders/tok-1',
        created_at: '',
        updated_at: '',
        expires_at: '',
        completed_at: null,
      },
      {
        id: 'ord-2',
        shop_id: 's1',
        payment_account_id: 'acc-1',
        product_name: 'Product 2',
        total_minor: 200000,
        required_advance_minor: 30000,
        expected_cod_minor: 170000,
        actual_cod_minor: null,
        account_provider: 'nagad',
        account_receiving_number: '01811223344',
        account_label: 'Nagad',
        lifecycle: 'awaiting_buyer',
        version: 1,
        review_reasons: [],
        buyer_revision: null,
        allocation_basis: null,
        portal_token: 'tok-2',
        portal_url: '/orders/tok-2',
        created_at: '',
        updated_at: '',
        expires_at: '',
        completed_at: null,
      },
      {
        id: 'ord-3',
        shop_id: 's1',
        payment_account_id: 'acc-1',
        product_name: 'Product 3',
        total_minor: 150000,
        required_advance_minor: 25000,
        expected_cod_minor: 125000,
        actual_cod_minor: null,
        account_provider: 'bkash',
        account_receiving_number: '01711223344',
        account_label: 'bKash',
        lifecycle: 'pending',
        version: 1,
        review_reasons: ['amount_mismatch'],
        buyer_revision: null,
        allocation_basis: null,
        portal_token: 'tok-3',
        portal_url: '/orders/tok-3',
        created_at: '',
        updated_at: '',
        expires_at: '',
        completed_at: null,
      },
    ];

    const root = createRoot(container);
    await act(async () => {
      root.render(<ShopMetricsBar orders={mockOrders} transactionsCount={5} />);
    });

    expect(container.textContent).toContain('Total Orders');
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('Confirmed');
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('Awaiting Buyer');
    expect(container.textContent).toContain('Pending Review');
    expect(container.textContent).toContain('Received Payments');
    expect(container.textContent).toContain('5');
  });
});
