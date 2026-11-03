import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSellerOrders } from './useSellerOrders';
import { useTransactionInbox } from './useTransactionInbox';
import { baseOrder } from './reviewAssistanceTestSupport';
import type { SellerOrder, ReceiptView } from './types';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
  vi.restoreAllMocks();
});

const sampleOrder = (id: string, name: string): SellerOrder => ({
  ...baseOrder,
  id,
  product_name: name,
});

const sampleReceipt = (id: string, amount_minor: number): ReceiptView => ({
  id,
  shop_id: 'shop-1',
  payment_account_id: 'acc-1',
  provider: 'bkash',
  trx_id: `TRX-${id}`,
  amount_minor,
  reconciliation_state: 'unmatched',
  has_conflict: false,
  version: 1,
  created_at: '2026-11-01T12:00:00Z',
  updated_at: '2026-11-01T12:00:00Z',
  observations: [],
  related_claims_count: 0,
});

describe('useSellerOrders pagination seams and session boundaries', () => {
  it('deduplicates shifted order IDs during pagination and tracks loading state', async () => {
    let capturedApi!: ReturnType<typeof useSellerOrders>;
    function Harness({ token }: { token?: string }) {
      const api = useSellerOrders(token, () => undefined);
      useEffect(() => {
        capturedApi = api;
      });
      return (
        <div>
          <span data-testid="count">{api.orders.length}</span>
          <span data-testid="loading">{api.loading ? 'loading' : 'idle'}</span>
        </div>
      );
    }

    const order1 = sampleOrder('ord-1', 'Product 1');
    const order2 = sampleOrder('ord-2', 'Product 2');

    let page = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      page += 1;
      if (page === 1) {
        return new Response(JSON.stringify({ items: [order1], next_cursor: 'cur-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // Second page returns ord-1 (e.g. cursor shifted) and ord-2.
      return new Response(JSON.stringify({ items: [order1, order2], next_cursor: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await act(async () => root.render(<Harness token="seller-token" />));
    await act(async () => capturedApi.reload());

    expect(capturedApi.orders.map((o) => o.id)).toEqual(['ord-1']);
    expect(capturedApi.nextCursor).toBe('cur-1');

    await act(async () => capturedApi.loadMore());

    expect(capturedApi.orders.map((o) => o.id)).toEqual(['ord-1', 'ord-2']);
    expect(capturedApi.nextCursor).toBeNull();
    expect(capturedApi.loading).toBe(false);
  });

  it('resets in-memory orders and query state on token change or sign-out', async () => {
    let capturedApi!: ReturnType<typeof useSellerOrders>;
    function Harness({ token }: { token?: string }) {
      const api = useSellerOrders(token, () => undefined);
      useEffect(() => {
        capturedApi = api;
      });
      return <div>{api.orders.length}</div>;
    }

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ items: [sampleOrder('ord-1', 'P1')], next_cursor: 'cur-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await act(async () => root.render(<Harness token="token-a" />));
    await act(async () => capturedApi.reload());
    expect(capturedApi.orders).toHaveLength(1);

    // Sign out: token becomes undefined.
    await act(async () => root.render(<Harness token={undefined} />));
    expect(capturedApi.orders).toHaveLength(0);
    expect(capturedApi.nextCursor).toBeNull();
  });
});

describe('useTransactionInbox pagination seams and session boundaries', () => {
  it('deduplicates receipt IDs during pagination merges', async () => {
    let capturedApi!: ReturnType<typeof useTransactionInbox>;
    function Harness({ token }: { token?: string }) {
      const api = useTransactionInbox(token, () => undefined);
      useEffect(() => {
        capturedApi = api;
      });
      return <div>{api.transactions.length}</div>;
    }

    const rc1 = sampleReceipt('rc-1', 50000);
    const rc2 = sampleReceipt('rc-2', 100000);

    let page = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      page += 1;
      if (page === 1) {
        return new Response(JSON.stringify({ items: [rc1], next_cursor: 'cur-tx' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ items: [rc1, rc2], next_cursor: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await act(async () => root.render(<Harness token="token-tx" />));
    await act(async () => capturedApi.reload());

    expect(capturedApi.transactions.map((t) => t.id)).toEqual(['rc-1']);

    await act(async () => capturedApi.loadMore());
    expect(capturedApi.transactions.map((t) => t.id)).toEqual(['rc-1', 'rc-2']);
    expect(capturedApi.nextCursor).toBeNull();
  });

  it('resets in-memory transactions on token change or sign-out', async () => {
    let capturedApi!: ReturnType<typeof useTransactionInbox>;
    function Harness({ token }: { token?: string }) {
      const api = useTransactionInbox(token, () => undefined);
      useEffect(() => {
        capturedApi = api;
      });
      return <div>{api.transactions.length}</div>;
    }

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ items: [sampleReceipt('rc-1', 50000)], next_cursor: 'cur-tx' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await act(async () => root.render(<Harness token="token-tx" />));
    await act(async () => capturedApi.reload());
    expect(capturedApi.transactions).toHaveLength(1);

    await act(async () => root.render(<Harness token={undefined} />));
    expect(capturedApi.transactions).toHaveLength(0);
    expect(capturedApi.nextCursor).toBeNull();
  });
});
