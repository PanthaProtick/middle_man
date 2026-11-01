import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { AttentionPreview } from './AttentionPreview';
import type { AttentionState } from './useAttentionQuery';
import { mockOrder } from './courierPostSubmissionTestData';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const readyState: AttentionState = {
  items: [{
    order: { ...mockOrder, id: 'attention-order-1' },
    category: 'unknown_outcome',
    reason_codes: ['UNKNOWN_OUTCOME', 'PRIOR_DAY_BACKLOG'],
  }, {
    order: { ...mockOrder, id: 'attention-order-2' },
    category: 'preparation',
    reason_codes: ['AWAITING_COURIER_PREPARATION'],
  }],
  total: 4,
  retrievedAt: '2026-11-01T06:00:00Z',
  calendarDate: '2026-11-01',
  nextCursor: '0:1730440800000000:attention-order-2',
  status: 'ready',
  error: null,
};

async function mount(state: AttentionState, actions: Partial<{
  onRefresh: () => void; onLoadMore: () => void;
  onOpenOrder: (order: typeof mockOrder) => void; onShowInDashboard: () => void;
}> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(
    <LocaleProvider>
      <AttentionPreview
        locale="en"
        state={state}
        onRefresh={actions.onRefresh ?? (() => undefined)}
        onLoadMore={actions.onLoadMore ?? (() => undefined)}
        onOpenOrder={actions.onOpenOrder ?? (() => undefined)}
        onShowInDashboard={actions.onShowInDashboard ?? (() => undefined)}
      />
    </LocaleProvider>,
  ));
  return { host, root };
}

const button = (host: HTMLElement, label: string): HTMLButtonElement => {
  const found = Array.from(host.querySelectorAll('button')).find(item => item.textContent?.trim() === label);
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
};

it('renders totals, categories, reason labels, and actions', async () => {
  const onOpenOrder = vi.fn();
  const onLoadMore = vi.fn();
  const onShowInDashboard = vi.fn();
  const { host } = await mount(readyState, { onOpenOrder, onLoadMore, onShowInDashboard });

  expect(host.textContent).toContain('Showing 2 of 4');
  expect(host.textContent).toContain('Courier outcome unknown');
  expect(host.textContent).toContain('Awaiting delivery preparation');
  expect(host.textContent).toContain('Created on an earlier Bangladesh day');
  expect(host.querySelectorAll('[data-testid="attention-order"]')).toHaveLength(2);
  expect(host.querySelector('[data-testid="attention-order"]')?.getAttribute('data-category'))
    .toBe('unknown_outcome');

  await act(async () => button(host, 'Open order').click());
  expect(onOpenOrder).toHaveBeenCalledWith(expect.objectContaining({ id: 'attention-order-1' }));
  await act(async () => button(host, 'Load more results').click());
  expect(onLoadMore).toHaveBeenCalledOnce();
  await act(async () => button(host, 'Show in dashboard').click());
  expect(onShowInDashboard).toHaveBeenCalledOnce();
});

it('copies the order reference and reports failure', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const { host } = await mount(readyState);

  await act(async () => button(host, 'Copy order reference').click());
  expect(writeText).toHaveBeenCalledWith('attention-order-1');
  expect(host.textContent).toContain('Order reference copied.');

  writeText.mockRejectedValueOnce(new Error('denied'));
  await act(async () => button(host, 'Copy order reference').click());
  expect(host.textContent).toContain('Could not copy the order reference.');
});

it('shows loading, empty, and error states without an unauthorized retry', async () => {
  const { host, root } = await mount({ ...readyState, status: 'loading' });
  expect(host.querySelector('[role="status"]')?.textContent).toContain('Retrieving');

  await act(async () => root.render(
    <LocaleProvider><AttentionPreview locale="en" state={{ ...readyState, items: [], total: 0, nextCursor: null }}
      onRefresh={() => undefined} onLoadMore={() => undefined} onOpenOrder={() => undefined}
      onShowInDashboard={() => undefined} /></LocaleProvider>,
  ));
  expect(host.querySelector('[role="status"]')?.textContent).toContain('No orders currently need attention');

  const onRefresh = vi.fn();
  await act(async () => root.render(
    <LocaleProvider><AttentionPreview locale="en" state={{ ...readyState, status: 'error', error: 'failed' }}
      onRefresh={onRefresh} onLoadMore={() => undefined} onOpenOrder={() => undefined}
      onShowInDashboard={() => undefined} /></LocaleProvider>,
  ));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Could not retrieve');
  await act(async () => button(host, 'Retry').click());
  expect(onRefresh).toHaveBeenCalledOnce();

  await act(async () => root.render(
    <LocaleProvider><AttentionPreview locale="en" state={{ ...readyState, status: 'error', error: 'unauthorized' }}
      onRefresh={onRefresh} onLoadMore={() => undefined} onOpenOrder={() => undefined}
      onShowInDashboard={() => undefined} /></LocaleProvider>,
  ));
  expect(host.textContent).toContain('Sign in again');
  expect(Array.from(host.querySelectorAll('button')).some(item => item.textContent === 'Retry')).toBe(false);
});
