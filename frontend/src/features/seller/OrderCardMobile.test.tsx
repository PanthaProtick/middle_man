import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { OrderList } from './OrderList';
import { baseOrder } from './reviewAssistanceTestSupport';

it('provides independent collapsed mobile summaries with linked details and working actions', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<OrderList orders={[baseOrder, { ...baseOrder, id: 'second' }]}
    statusFilter="" onFilterChange={vi.fn()} nextCursor={null} onLoadMore={vi.fn()} />));
  const summaries = host.querySelectorAll<HTMLButtonElement>('.order-card-mobile-summary');
  expect(summaries).toHaveLength(2);
  for (const summary of summaries) {
    expect(summary.textContent).toContain(baseOrder.product_name);
    expect(summary.textContent).toContain('BDT');
    expect(summary.querySelector('.order-card-mobile-status')?.textContent).toBeTruthy();
    expect(summary.getAttribute('aria-expanded')).toBe('false');
    const body = document.getElementById(summary.getAttribute('aria-controls')!);
    expect(body?.classList.contains('order-card-body-open')).toBe(false);
    expect(body?.querySelector('.order-card-actions')).not.toBeNull();
  }
  await act(async () => summaries[0].click());
  expect(summaries[0].getAttribute('aria-expanded')).toBe('true');
  expect(summaries[1].getAttribute('aria-expanded')).toBe('false');
  expect(document.getElementById(summaries[0].getAttribute('aria-controls')!)
    ?.classList.contains('order-card-body-open')).toBe(true);
  await act(async () => summaries[0].click());
  expect(summaries[0].getAttribute('aria-expanded')).toBe('false');
  await act(async () => root.unmount());
  host.remove();
});
