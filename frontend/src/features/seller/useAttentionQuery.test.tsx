import { act, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useAttentionQuery, type AttentionQuery } from './useAttentionQuery';
import { fetchAttentionPreview } from './workQueryApi';
import type { AttentionQueryPreview } from './types';

vi.mock('./workQueryApi', () => ({ fetchAttentionPreview: vi.fn() }));

const page: AttentionQueryPreview = {
  query: 'attention', items: [], total: 12, next_cursor: '0:1730440800000000:old-order',
  retrieved_at: '2026-11-01T06:00:00Z', calendar_date: '2026-11-01', timezone: 'Asia/Dhaka',
};

afterEach(() => {
  vi.resetAllMocks();
  document.body.innerHTML = '';
});

async function mount() {
  let query: AttentionQuery;
  function Harness({ token }: { token?: string }) {
    const value = useAttentionQuery(token);
    useLayoutEffect(() => { query = value; });
    return null;
  }
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const render = async (token?: string) => {
    await act(async () => root.render(<Harness token={token} />));
  };
  await render('old-token');
  return { root, render, current: () => query! };
}

it('loads, accumulates pages, and keeps the full total', async () => {
  vi.mocked(fetchAttentionPreview)
    .mockResolvedValueOnce({ ...page, items: [{
      order: { id: 'order-1' } as AttentionQueryPreview['items'][number]['order'],
      category: 'failed_submission', reason_codes: ['FAILED_SUBMISSION'],
    }], total: 2 })
    .mockResolvedValueOnce({ ...page, items: [{
      order: { id: 'order-2' } as AttentionQueryPreview['items'][number]['order'],
      category: 'preparation', reason_codes: ['AWAITING_COURIER_PREPARATION'],
    }], total: 2, next_cursor: null });
  const harness = await mount();
  await act(async () => { await harness.current().refresh(); });
  expect(harness.current().status).toBe('ready');
  expect(harness.current().total).toBe(2);
  expect(harness.current().items).toHaveLength(1);

  await act(async () => harness.current().loadMore());
  expect(fetchAttentionPreview).toHaveBeenLastCalledWith({ cursor: page.next_cursor, limit: 10 }, 'old-token');
  expect(harness.current().items.map(item => item.order.id)).toEqual(['order-1', 'order-2']);
  expect(harness.current().nextCursor).toBeNull();
  await act(async () => harness.root.unmount());
});

it.each(['new-token', undefined])('invalidates pending results after token changes to %s', async token => {
  let resolve!: (value: AttentionQueryPreview) => void;
  vi.mocked(fetchAttentionPreview).mockReturnValue(new Promise(done => { resolve = done; }));
  const harness = await mount();
  let pending!: Promise<void>;
  await act(async () => { pending = harness.current().refresh(); });
  expect(harness.current().status).toBe('loading');
  await harness.render(token);
  await act(async () => { resolve(page); await pending; });
  expect(harness.current().status).toBe('idle');
  expect(harness.current().total).toBe(0);
  expect(harness.current().nextCursor).toBeNull();
  await act(async () => harness.root.unmount());
});

it('replaces repeated orders with current facts when priority changes between pages', async () => {
  const order = { id: 'moving-order' } as AttentionQueryPreview['items'][number]['order'];
  vi.mocked(fetchAttentionPreview)
    .mockResolvedValueOnce({ ...page, items: [{
      order, category: 'unknown_outcome', reason_codes: ['UNKNOWN_OUTCOME'],
    }] })
    .mockResolvedValueOnce({ ...page, next_cursor: null, items: [{
      order, category: 'failed_submission', reason_codes: ['FAILED_SUBMISSION'],
    }] });
  const harness = await mount();
  await act(async () => { await harness.current().refresh(); });
  await act(async () => harness.current().loadMore());
  expect(harness.current().items).toHaveLength(1);
  expect(harness.current().items[0].category).toBe('failed_submission');
  expect(harness.current().nextCursor).toBeNull();
  await act(async () => harness.root.unmount());
});

it('clears a completed preview and fetches using the replacement token', async () => {
  vi.mocked(fetchAttentionPreview).mockResolvedValue(page);
  const harness = await mount();
  await act(async () => { await harness.current().refresh(); });
  expect(harness.current().total).toBe(12);
  await harness.render('new-token');
  expect(harness.current().retrievedAt).toBeNull();
  expect(harness.current().total).toBe(0);
  await act(async () => { await harness.current().refresh(); });
  expect(fetchAttentionPreview).toHaveBeenLastCalledWith({ cursor: undefined, limit: 10 }, 'new-token');
  expect(harness.current().status).toBe('ready');
  await act(async () => harness.root.unmount());
});

it('reports unauthorized without a token and failed for malformed responses', async () => {
  const harness = await mount();
  await harness.render(undefined);
  await act(async () => { await harness.current().refresh(); });
  expect(harness.current().error).toBe('unauthorized');
  expect(fetchAttentionPreview).not.toHaveBeenCalled();

  vi.mocked(fetchAttentionPreview).mockResolvedValue({
    ...page, items: null as unknown as AttentionQueryPreview['items'],
  });
  await harness.render('token');
  await act(async () => { await harness.current().refresh(); });
  expect(harness.current().status).toBe('error');
  expect(harness.current().error).toBe('failed');
  await act(async () => harness.root.unmount());
});
