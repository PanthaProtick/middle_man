import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { OrderList } from './OrderList';
import { OrderDetailModal } from './OrderDetailModal';
import type { SellerOrder } from './types';

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

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

  it.each([
    ['list', 'denied'], ['detail', 'denied'], ['list', 'missing'], ['detail', 'missing'],
  ])('reports %s buyer-link clipboard failure (%s) and permits retry', async (surface, failure) => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard denied'));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: failure === 'missing' ? undefined : { writeText } });
    await act(async () => root.render(surface === 'list'
      ? <OrderList orders={[confirmedOrder]} statusFilter="" onFilterChange={() => {}} nextCursor={null} onLoadMore={() => {}} />
      : <OrderDetailModal order={confirmedOrder} onClose={() => {}} />));
    const copyButton = () => Array.from(container.querySelectorAll('button')).find(button => /Copy (Buyer )?Link/.test(button.textContent ?? ''))!;
    await act(async () => copyButton().click());
    expect(container.textContent).not.toContain('Copied');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Could not copy');
    expect(container.querySelector<HTMLInputElement>('input[readonly]')?.value).toBe(`${window.location.origin}${confirmedOrder.portal_url}`);
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await act(async () => copyButton().click());
    expect(writeText).toHaveBeenLastCalledWith(`${window.location.origin}${confirmedOrder.portal_url}`);
    expect(container.textContent).toContain('Copied');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('opens a labelled modal with focus on its named close control', async () => {
    await act(async () => root.render(<OrderDetailModal order={confirmedOrder} onClose={vi.fn()} />));
    const dialog = container.querySelector('dialog');
    expect(dialog?.open).toBe(true);
    expect(document.getElementById(dialog!.getAttribute('aria-labelledby')!)?.textContent).toBe('Order & Link Details');
    const close = dialog!.querySelector<HTMLButtonElement>('button[aria-label="Close order details"]');
    expect(close).not.toBeNull();
    expect(document.activeElement).toBe(close);
  });

  it.each(['cancel', 'icon', 'footer'])('dismisses via %s and returns focus to Inspect', async method => {
    await act(async () => root.render(<StrictMode><OrderList orders={[confirmedOrder]}
      statusFilter="" onFilterChange={() => {}} nextCursor={null} onLoadMore={() => {}} /></StrictMode>));
    const inspect = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Inspect')!;
    inspect.focus();
    await act(async () => inspect.click());
    const dialog = container.querySelector('dialog')!;
    await act(async () => {
      if (method === 'cancel') dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      else if (method === 'icon') dialog.querySelector<HTMLButtonElement>('[aria-label="Close order details"]')!.click();
      else Array.from(dialog.querySelectorAll('button')).find(button => button.textContent === 'Close')!.click();
    });
    expect(container.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(inspect);
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
