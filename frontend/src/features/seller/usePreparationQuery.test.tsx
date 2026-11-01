import { act, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { usePreparationQuery, type PreparationQuery } from './usePreparationQuery';
import { fetchPreparationPreview } from './workQueryApi';
import type { PreparationQueryPreview } from './types';

vi.mock('./workQueryApi', () => ({ fetchPreparationPreview: vi.fn() }));

const page: PreparationQueryPreview = {
  query: 'preparation', items: [], total: 12, next_cursor: 'old-order',
  retrieved_at: '2026-11-01T06:00:00Z', calendar_date: '2026-11-01', timezone: 'Asia/Dhaka',
};

afterEach(() => {
  vi.resetAllMocks();
  document.body.innerHTML = '';
});

async function mount() {
  let query: PreparationQuery;
  function Harness({ token }: { token?: string }) {
    const value = usePreparationQuery(token);
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

it.each(['new-token', undefined])('invalidates pending results after token changes to %s', async token => {
  let resolve!: (value: PreparationQueryPreview) => void;
  vi.mocked(fetchPreparationPreview).mockReturnValue(new Promise(done => { resolve = done; }));
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

it('clears a completed preview and fetches using the replacement token', async () => {
  vi.mocked(fetchPreparationPreview).mockResolvedValue(page);
  const harness = await mount();
  await act(async () => { await harness.current().refresh(); });
  expect(harness.current().total).toBe(12);
  await harness.render('new-token');
  expect(harness.current().retrievedAt).toBeNull();
  expect(harness.current().total).toBe(0);
  await act(async () => { await harness.current().refresh(); });
  expect(fetchPreparationPreview).toHaveBeenLastCalledWith({ cursor: undefined, limit: 10 }, 'new-token');
  expect(harness.current().status).toBe('ready');
  await act(async () => harness.root.unmount());
});
