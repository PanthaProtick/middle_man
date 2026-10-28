import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { StructuredRetentionPanel } from './StructuredRetentionPanel';

afterEach(() => vi.unstubAllGlobals());

it('shows overdue failures, retries cleanup and refreshes the workspace', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ overdue: 2, failed: 1, removed: 0 })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ overdue: 0, failed: 0, removed: 2 })));
  vi.stubGlobal('fetch', fetch);
  const container = document.createElement('div');
  const root = createRoot(container);
  const updated = vi.fn();
  await act(async () => root.render(<StructuredRetentionPanel token="synthetic" onCleaned={updated} />));
  expect(container.textContent).toContain('2 overdue');
  expect(container.textContent).toContain('1 failed');
  await act(async () => container.querySelector('button')?.click());
  expect(container.textContent).toContain('Removed 2 completed records');
  expect(container.textContent).toContain('0 overdue');
  expect(updated).toHaveBeenCalled();
  await act(async () => root.unmount());
});

it('shows loading, an unavailable response and a working retry', async () => {
  let finish: ((value: Response) => void) | undefined;
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ overdue: 0, failed: 0, removed: 0 }))));
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => root.render(<StructuredRetentionPanel />));
  expect(container.textContent).toContain('Loading');
  await act(async () => finish?.(new Response(JSON.stringify({ error: { message: 'Service unavailable' } }), { status: 503 })));
  expect(container.textContent).toContain('Failed to load retention status');
  await act(async () => container.querySelector('button')?.click());
  expect(container.textContent).toContain('0 overdue');
  await act(async () => root.unmount());
});
