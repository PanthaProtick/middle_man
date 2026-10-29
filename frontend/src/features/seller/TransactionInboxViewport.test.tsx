import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { TransactionInbox } from './TransactionInbox';
import { useDateSelection } from './useDateSelection';
import type { ReceiptView } from './types';

vi.mock('./EvidenceResolution', () => ({
  EvidenceResolution: () => <div data-testid="mock-evidence-resolution">Resolution Content</div>,
}));

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

async function mount(element: React.JSX.Element) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, root };
}

const sampleTx: ReceiptView = {
  id: 'tx-viewport-1',
  shop_id: 's1',
  payment_account_id: 'acc-1',
  provider: 'bkash',
  trx_id: 'TRX_VIEWPORT_TEST',
  amount_minor: 12000,
  sender_number_raw: '01700000000',
  sender_number_canonical: '01700000000',
  occurred_at: '2026-10-25T10:00:00Z',
  reconciliation_state: 'unmatched',
  has_conflict: false,
  version: 1,
  created_at: '2026-10-25T10:00:00Z',
  updated_at: '2026-10-25T10:00:00Z',
  observations: [],
  related_claims_count: 0,
};

function Harness(props: Partial<React.ComponentProps<typeof TransactionInbox>>) {
  const dates = useDateSelection(() => undefined);
  return (
    <LocaleProvider>
      <TransactionInbox
        dates={dates}
        transactions={[sampleTx]}
        filter=""
        onFilterChange={() => undefined}
        search=""
        onSearchChange={() => undefined}
        onRefresh={() => undefined}
        {...props}
      />
    </LocaleProvider>
  );
}

it('keeps header, badge, search, date controls, filter, and refresh pinned outside the scroll viewport', async () => {
  const { host } = await mount(<Harness />);

  const viewport = host.querySelector('.ledger-scroll-viewport');
  expect(viewport).not.toBeNull();

  const header = host.querySelector('.isolated-section-header');
  expect(header).not.toBeNull();
  expect(viewport?.contains(header)).toBe(false);

  const badge = host.querySelector('.section-tab-count');
  expect(badge).not.toBeNull();
  expect(viewport?.contains(badge)).toBe(false);

  const searchForm = host.querySelector('form[role="search"]');
  expect(searchForm).not.toBeNull();
  expect(viewport?.contains(searchForm)).toBe(false);

  const dateSelect = host.querySelector('#transaction-date-mode');
  expect(dateSelect).not.toBeNull();
  expect(viewport?.contains(dateSelect)).toBe(false);

  const filterSelect = host.querySelector('#transaction-filter');
  expect(filterSelect).not.toBeNull();
  expect(viewport?.contains(filterSelect)).toBe(false);

  const refreshBtn = Array.from(host.querySelectorAll('button')).find((b) =>
    b.textContent?.includes('Refresh Inbox'),
  );
  expect(refreshBtn).toBeDefined();
  expect(viewport?.contains(refreshBtn!)).toBe(false);
});

it('renders transaction cards and load more button inside the scroll viewport', async () => {
  const handleLoadMore = vi.fn();
  const { host } = await mount(
    <Harness nextCursor="cursor-1" onLoadMore={handleLoadMore} />,
  );

  const viewport = host.querySelector('.ledger-scroll-viewport');
  expect(viewport).not.toBeNull();
  expect(viewport?.textContent).toContain('TRX_VIEWPORT_TEST');

  const loadMoreBtn = Array.from(viewport?.querySelectorAll('button') ?? []).find((b) =>
    b.textContent?.includes('Load More Received Payments'),
  );
  expect(loadMoreBtn).toBeDefined();
  expect(viewport?.contains(loadMoreBtn!)).toBe(true);
});

it('renders inline evidence resolution inside the scroll viewport when a card is expanded', async () => {
  const { host } = await mount(<Harness token="test-token" />);

  const viewport = host.querySelector('.ledger-scroll-viewport');
  expect(viewport).not.toBeNull();

  const cardHeader = host.querySelector('[data-testid="tx-header-tx-viewport-1"]');
  expect(cardHeader).not.toBeNull();

  await act(async () => {
    cardHeader?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  const evidencePanel = viewport?.querySelector('[data-testid="mock-evidence-resolution"]');
  expect(evidencePanel).not.toBeNull();
  expect(viewport?.contains(evidencePanel!)).toBe(true);
});

it('renders loading state inside the scroll viewport with empty-state styling', async () => {
  const { host } = await mount(<Harness transactions={[]} loading={true} />);

  const viewport = host.querySelector('.ledger-scroll-viewport');
  expect(viewport).not.toBeNull();

  const statusEl = viewport?.querySelector('[role="status"]');
  expect(statusEl).not.toBeNull();
  expect(viewport?.querySelector('.ledger-scroll-empty-state')).not.toBeNull();
});

it('renders empty state inside the scroll viewport with empty-state styling', async () => {
  const { host } = await mount(<Harness transactions={[]} loading={false} />);

  const viewport = host.querySelector('.ledger-scroll-viewport');
  expect(viewport).not.toBeNull();

  const emptyState = viewport?.querySelector('.ledger-scroll-empty-state');
  expect(emptyState).not.toBeNull();
  expect(emptyState?.textContent).toBeTruthy();
});
