import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { OrderList } from './OrderList';
import { OrderDetailModal } from './OrderDetailModal';
import type { SellerOrder } from './types';

describe('Order Reconciliation and Review UI', () => {
  let container: HTMLDivElement;
  let root: Root;

  const confirmedOrder: SellerOrder = {
    id: 'ord-conf-1',
    shop_id: 's1',
    payment_account_id: 'acc-1',
    product_name: 'Silk Saree',
    total_minor: 500000,
    required_advance_minor: 100000,
    expected_cod_minor: 400000,
    actual_cod_minor: 400000,
    account_provider: 'bkash',
    account_receiving_number: '01711223344',
    account_label: 'Primary bKash',
    lifecycle: 'confirmed',
    version: 2,
    review_reasons: [],
    buyer_revision: 1,
    allocation_basis: 'automatic',
    portal_token: 'token-conf-1',
    portal_url: '/orders/token-conf-1',
    created_at: '2026-10-24T10:00:00Z',
    updated_at: '2026-10-24T10:05:00Z',
    expires_at: '2026-10-26T10:00:00Z',
    completed_at: '2026-10-24T10:05:00Z',
  };

  const pendingReviewOrder: SellerOrder = {
    id: 'ord-rev-1',
    shop_id: 's1',
    payment_account_id: 'acc-1',
    product_name: 'Cotton Kurti',
    total_minor: 300000,
    required_advance_minor: 50000,
    expected_cod_minor: 250000,
    actual_cod_minor: null,
    account_provider: 'bkash',
    account_receiving_number: '01711223344',
    account_label: 'Primary bKash',
    lifecycle: 'pending',
    version: 1,
    review_reasons: ['SENDER_MISMATCH', 'TIME_UNCLEAR'],
    buyer_revision: 1,
    allocation_basis: null,
    portal_token: 'token-rev-1',
    portal_url: '/orders/token-rev-1',
    created_at: '2026-10-24T10:00:00Z',
    updated_at: '2026-10-24T10:10:00Z',
    expires_at: '2026-10-26T10:00:00Z',
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

  it('renders confirmed order in OrderList with Confirmed badge and Actual COD', async () => {
    await act(async () => {
      root.render(
        <OrderList
          orders={[confirmedOrder]}
          statusFilter=""
          onFilterChange={vi.fn()}
          nextCursor={null}
          onLoadMore={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain('Silk Saree');
    expect(container.textContent).toContain('Confirmed');
    expect(container.textContent).toContain('Actual COD:');
    expect(container.textContent).toContain('BDT 4,000');
    expect(container.textContent).toContain('Confirmed: 1');
  });

  it('renders pending order in OrderList with Review reasons banner', async () => {
    await act(async () => {
      root.render(
        <OrderList
          orders={[pendingReviewOrder]}
          statusFilter=""
          onFilterChange={vi.fn()}
          nextCursor={null}
          onLoadMore={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain('Cotton Kurti');
    expect(container.textContent).toContain('Expected COD:');
    expect(container.textContent).toContain('BDT 2,500');
    expect(container.textContent).toContain('Review Exceptions: 1');
    expect(container.textContent).toContain('Review:');
    expect(container.textContent).toContain('SENDER_MISMATCH');
    expect(container.textContent).toContain('TIME_UNCLEAR');
  });

  it('renders confirmed payment allocation and basis in OrderDetailModal', async () => {
    await act(async () => {
      root.render(<OrderDetailModal order={confirmedOrder} onClose={vi.fn()} />);
    });

    expect(container.textContent).toContain('Order & Link Details');
    expect(container.textContent).toContain('Actual Remaining COD');
    expect(container.textContent).toContain('BDT 4,000');
    expect(container.textContent).toContain('Confirmed Payment Allocation');
    expect(container.textContent).toContain('automatic');
    expect(container.textContent).toContain('Accepted Advance:');
    expect(container.textContent).toContain('BDT 1,000');
    expect(container.textContent).toContain('Confirmed At:');
  });

  it('renders review reasons alert banner in OrderDetailModal for pending order', async () => {
    await act(async () => {
      root.render(<OrderDetailModal order={pendingReviewOrder} onClose={vi.fn()} />);
    });

    expect(container.textContent).toContain('Review Required');
    expect(container.textContent).toContain('SENDER_MISMATCH');
    expect(container.textContent).toContain('TIME_UNCLEAR');
    expect(container.textContent).toContain('Expected Remaining COD');
  });
});
