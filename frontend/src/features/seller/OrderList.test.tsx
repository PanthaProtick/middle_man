import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { OrderList } from './OrderList';
import { mockOrder } from './courierPostSubmissionTestData';
import type { SellerOrder } from './types';

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

const sampleOrder: SellerOrder = {
  ...mockOrder,
  id: 'ord-test-1',
};

it('keeps section header, search form, date controls, and export pinned outside the scroll viewport', async () => {
  const { host } = await mount(
    <LocaleProvider>
      <OrderList
        token="test-token"
        orders={[sampleOrder]}
        statusFilter=""
        onFilterChange={() => undefined}
        nextCursor={null}
        onLoadMore={() => undefined}
      />
    </LocaleProvider>,
  );

  const viewport = host.querySelector('.ledger-scroll-viewport');
  expect(viewport).not.toBeNull();

  const header = host.querySelector('.isolated-section-header');
  expect(header).not.toBeNull();
  expect(viewport?.contains(header)).toBe(false);

  const searchForm = host.querySelector('form[role="search"]');
  expect(searchForm).not.toBeNull();
  expect(viewport?.contains(searchForm)).toBe(false);

  const dateSelect = host.querySelector('#order-date-mode');
  expect(dateSelect).not.toBeNull();
  expect(viewport?.contains(dateSelect)).toBe(false);

  const exportBtn = host.querySelector('button[aria-busy]');
  expect(exportBtn).not.toBeNull();
  expect(viewport?.contains(exportBtn)).toBe(false);
});

it('renders order cards and load more button inside the scroll viewport', async () => {
  const handleLoadMore = vi.fn();
  const { host } = await mount(
    <LocaleProvider>
      <OrderList
        token="test-token"
        orders={[sampleOrder]}
        statusFilter=""
        onFilterChange={() => undefined}
        nextCursor="cursor-123"
        onLoadMore={handleLoadMore}
      />
    </LocaleProvider>,
  );

  const viewport = host.querySelector('.ledger-scroll-viewport');
  expect(viewport).not.toBeNull();
  expect(viewport?.textContent).toContain('Premium Leather Bag');

  const loadMoreBtn = Array.from(viewport?.querySelectorAll('button') ?? []).find(
    (b) => b.textContent?.includes('Load More') || b.textContent?.includes('আরও দেখুন'),
  );
  expect(loadMoreBtn).toBeDefined();
  expect(viewport?.contains(loadMoreBtn!)).toBe(true);
});

it('renders loading state inside the scroll viewport with empty-state styling', async () => {
  const { host } = await mount(
    <LocaleProvider>
      <OrderList
        token="test-token"
        orders={[]}
        statusFilter=""
        onFilterChange={() => undefined}
        nextCursor={null}
        onLoadMore={() => undefined}
        loading={true}
      />
    </LocaleProvider>,
  );

  const viewport = host.querySelector('.ledger-scroll-viewport');
  expect(viewport).not.toBeNull();

  const statusEl = viewport?.querySelector('[role="status"]');
  expect(statusEl).not.toBeNull();
  expect(viewport?.querySelector('.ledger-scroll-empty-state')).not.toBeNull();
});

it('renders empty state inside the scroll viewport with empty-state styling', async () => {
  const { host } = await mount(
    <LocaleProvider>
      <OrderList
        token="test-token"
        orders={[]}
        statusFilter=""
        onFilterChange={() => undefined}
        nextCursor={null}
        onLoadMore={() => undefined}
        loading={false}
      />
    </LocaleProvider>,
  );

  const viewport = host.querySelector('.ledger-scroll-viewport');
  expect(viewport).not.toBeNull();

  const emptyState = viewport?.querySelector('.ledger-scroll-empty-state');
  expect(emptyState).not.toBeNull();
  expect(emptyState?.textContent).toBeTruthy();
});
