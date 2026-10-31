import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { PathaoCatalogStatus } from './PathaoCatalogStatus';
import { requestJson } from './api';

vi.mock('./api', () => ({requestJson: vi.fn()}));

it('shows saved age and refresh failures, then follows an explicit refresh to completion', async () => {
  vi.useFakeTimers();
  const saved = {catalog_version: 'old', refreshed_at: '2026-10-30T12:00:00Z',
    attempted_at: '2026-10-31T12:00:00Z', refreshing: false, failed: true};
  const request = vi.mocked(requestJson);
  request.mockResolvedValueOnce(saved).mockResolvedValueOnce(saved)
    .mockResolvedValueOnce({...saved, refreshing: true, failed: false})
    .mockResolvedValueOnce({...saved, catalog_version: 'new', refreshing: false, failed: false});
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<PathaoCatalogStatus token="synthetic" environment="sandbox" />));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(container.textContent).toContain('Locations last updated');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Previously saved locations');
    const refresh = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Refresh locations')!;
    await act(async () => refresh.click());
    expect(refresh.disabled).toBe(true);
    expect(request).toHaveBeenNthCalledWith(2, '/api/seller/courier/pathao/sandbox/catalog/refresh', {method: 'POST'}, 'synthetic');
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(container.textContent).toContain('Updating delivery locations');
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(refresh.disabled).toBe(false);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    const calls = request.mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(request).toHaveBeenCalledTimes(calls);
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.resetAllMocks();
  }
});
