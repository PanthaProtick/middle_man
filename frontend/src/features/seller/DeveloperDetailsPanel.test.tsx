import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DeveloperDetailsPanel } from './DeveloperDetailsPanel';
import { OrderDetailModal } from './OrderDetailModal';
import { OrderList } from './OrderList';
import type { SellerOrder } from './types';

describe('DeveloperDetailsPanel and toggle buttons', () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

  const mockOrder: SellerOrder = {
    id: 'ord-test-uuid-12345',
    shop_id: 'shop-1',
    payment_account_id: 'acc-uuid-67890',
    product_name: 'Traditional Saree',
    total_minor: 350000,
    required_advance_minor: 50000,
    expected_cod_minor: 300000,
    actual_cod_minor: 300000,
    account_provider: 'bkash',
    account_receiving_number: '01711223344',
    account_label: 'Primary bKash',
    lifecycle: 'pending',
    version: 3,
    review_reasons: ['SENDER_MISMATCH', 'AMOUNT_MISMATCH'],
    buyer_revision: 2,
    allocation_basis: 'manual',
    portal_token: 'portal-tok-abc',
    portal_url: '/orders/portal-tok-abc',
    predecessor_order_id: 'ord-pred-uuid-000',
    replaced_by_order_id: 'ord-repl-uuid-999',
    created_at: '2026-10-24T10:00:00Z',
    updated_at: '2026-10-24T10:30:00Z',
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
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('DeveloperDetailsPanel starts collapsed and toggles open on click', async () => {
    await act(async () => {
      root.render(<DeveloperDetailsPanel order={mockOrder} />);
    });

    const toggleBtn = container.querySelector('button[aria-controls]') as HTMLButtonElement;
    expect(toggleBtn).not.toBeNull();
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');

    const region = container.querySelector('[role="region"]') as HTMLElement;
    expect(region).not.toBeNull();
    expect(region.style.display).toBe('none');

    // Click to expand
    await act(async () => {
      toggleBtn.click();
    });

    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
    expect(region.style.display).toBe('block');
    expect(region.textContent).toContain('ord-test-uuid-12345');
    expect(region.textContent).toContain('v3');
    expect(region.textContent).toContain('manual');
    expect(region.textContent).toContain('acc-uuid-67890');
    expect(region.textContent).toContain('ord-pred-uuid-000');
    expect(region.textContent).toContain('ord-repl-uuid-999');
    expect(region.textContent).toContain('SENDER_MISMATCH');
    expect(region.textContent).toContain('AMOUNT_MISMATCH');

    // Click again to collapse
    await act(async () => {
      toggleBtn.click();
    });

    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
    expect(region.style.display).toBe('none');
  });

  it('DeveloperDetailsPanel copies diagnostic report to clipboard when clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    await act(async () => {
      root.render(<DeveloperDetailsPanel order={mockOrder} initialOpen={true} />);
    });

    const copyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Copy dev info')
    );
    expect(copyBtn).toBeDefined();

    await act(async () => {
      copyBtn?.click();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    const copiedText = writeText.mock.calls[0][0];
    expect(copiedText).toContain('--- ORDER DIAGNOSTIC DETAILS (FOR DEV SUPPORT) ---');
    expect(copiedText).toContain('Order ID: ord-test-uuid-12345');
    expect(copiedText).toContain('Version: 3');
    expect(copiedText).toContain('Allocation Basis: manual');
    expect(copiedText).toContain('Payment Account ID: acc-uuid-67890');

    expect(container.textContent).toContain('Copied to clipboard');
  });

  it('OrderDetailModal integrates DeveloperDetailsPanel and toggles review error codes', async () => {
    await act(async () => {
      root.render(<OrderDetailModal order={mockOrder} onClose={vi.fn()} />);
    });

    // Verify error codes toggle button
    const codesToggle = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('error codes')
    );
    expect(codesToggle).toBeDefined();
    expect(codesToggle?.textContent).toContain('Show error codes (for dev)');

    // Codes container starts hidden
    const codesDiv = container.querySelector('.card div[style*="background: rgba(239, 68, 68, 0.1)"] div[style*="display: none"]');
    expect(codesDiv).not.toBeNull();

    // Toggle on error codes
    await act(async () => {
      codesToggle?.click();
    });

    expect(codesToggle?.textContent).toContain('Hide error codes');

    // Developer details toggle is also present inside modal
    const devToggle = container.querySelector('button[aria-controls^="dev-panel"]') as HTMLButtonElement;
    expect(devToggle).not.toBeNull();
    expect(devToggle.textContent).toContain('Developer details');

    await act(async () => {
      devToggle.click();
    });

    expect(devToggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('OrderList provides toggle button for review codes on pending orders', async () => {
    await act(async () => {
      root.render(
        <OrderList
          orders={[mockOrder]}
          statusFilter=""
          onFilterChange={vi.fn()}
          nextCursor={null}
          onLoadMore={vi.fn()}
        />
      );
    });

    const toggleBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent === 'Show codes'
    );
    expect(toggleBtn).toBeDefined();

    await act(async () => {
      toggleBtn?.click();
    });

    expect(toggleBtn?.textContent).toBe('Hide codes');
    expect(toggleBtn?.getAttribute('aria-expanded')).toBe('true');

    await act(async () => {
      toggleBtn?.click();
    });

    expect(toggleBtn?.textContent).toBe('Show codes');
    expect(toggleBtn?.getAttribute('aria-expanded')).toBe('false');
  });
});
