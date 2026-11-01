import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { PreparationPreview } from './PreparationPreview';
import type { PreparationState } from './usePreparationQuery';
import { mockOrder } from './courierPostSubmissionTestData';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const readyState: PreparationState = {
  items: [{
    order: { ...mockOrder, id: 'order-prep-1' },
    reason_codes: ['AWAITING_COURIER_PREPARATION', 'PRIOR_DAY_BACKLOG'],
  }],
  total: 3,
  retrievedAt: '2026-11-01T06:00:00Z',
  calendarDate: '2026-11-01',
  nextCursor: 'order-prep-2',
  status: 'ready',
  error: null,
};

async function mount(state: PreparationState, actions: Partial<{
  onRefresh: () => void; onLoadMore: () => void;
  onOpenOrder: (order: typeof mockOrder) => void; onShowInDashboard: () => void;
}> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(
    <LocaleProvider>
      <PreparationPreview
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

it('renders totals, retrieval time, reason labels, and stable order actions', async () => {
  const onOpenOrder = vi.fn();
  const onLoadMore = vi.fn();
  const onShowInDashboard = vi.fn();
  const { host } = await mount(readyState, { onOpenOrder, onLoadMore, onShowInDashboard });

  expect(host.textContent).toContain('Showing 1 of 3');
  expect(host.textContent).toContain('Bangladesh time');
  expect(host.textContent).toContain('No courier submission started');
  expect(host.textContent).toContain('Created on an earlier Bangladesh day');
  expect(host.textContent).toContain('order-prep-1');

  await act(async () => button(host, 'Open order').click());
  expect(onOpenOrder).toHaveBeenCalledWith(expect.objectContaining({ id: 'order-prep-1' }));
  await act(async () => button(host, 'Load more results').click());
  expect(onLoadMore).toHaveBeenCalledOnce();
  await act(async () => button(host, 'Show in dashboard').click());
  expect(onShowInDashboard).toHaveBeenCalledOnce();
});

it('copies the server-returned order reference and reports failure', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const { host } = await mount(readyState);

  await act(async () => button(host, 'Copy order reference').click());
  expect(writeText).toHaveBeenCalledWith('order-prep-1');
  expect(host.textContent).toContain('Order reference copied.');

  writeText.mockRejectedValueOnce(new Error('denied'));
  await act(async () => button(host, 'Copy order reference').click());
  expect(host.textContent).toContain('Could not copy the order reference.');
});

it('shows loading, empty, and error states without a misleading unauthorized retry', async () => {
  const { host, root } = await mount({ ...readyState, status: 'loading' });
  expect(host.querySelector('[role="status"]')?.textContent).toContain('Retrieving');

  await act(async () => root.render(
    <LocaleProvider><PreparationPreview locale="en" state={{ ...readyState, items: [], total: 0, nextCursor: null }}
      onRefresh={() => undefined} onLoadMore={() => undefined} onOpenOrder={() => undefined}
      onShowInDashboard={() => undefined} /></LocaleProvider>,
  ));
  expect(host.querySelector('[role="status"]')?.textContent).toContain('No confirmed orders');

  const onRefresh = vi.fn();
  await act(async () => root.render(
    <LocaleProvider><PreparationPreview locale="en" state={{ ...readyState, status: 'error', error: 'failed' }}
      onRefresh={onRefresh} onLoadMore={() => undefined} onOpenOrder={() => undefined}
      onShowInDashboard={() => undefined} /></LocaleProvider>,
  ));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Could not retrieve');
  await act(async () => button(host, 'Retry').click());
  expect(onRefresh).toHaveBeenCalledOnce();

  await act(async () => root.render(
    <LocaleProvider><PreparationPreview locale="en" state={{ ...readyState, status: 'error', error: 'unauthorized' }}
      onRefresh={onRefresh} onLoadMore={() => undefined} onOpenOrder={() => undefined}
      onShowInDashboard={() => undefined} /></LocaleProvider>,
  ));
  expect(host.textContent).toContain('Sign in again');
  expect(Array.from(host.querySelectorAll('button')).some(item => item.textContent === 'Retry')).toBe(false);
});
