import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useTodayMetrics } from './useTodayMetrics';
import { baseOrder } from './reviewAssistanceTestSupport';
import type { ReceiptView, SellerOrder } from './types';

afterEach(() => vi.restoreAllMocks());

it('reloads independent totals after list changes and rejects late responses and failures', async () => {
  const pending: Array<(response: Response) => void> = [];
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    new Promise<Response>(resolve => pending.push(resolve)));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const receipts: ReceiptView[] = [];
  function Harness({ orders }: { orders: SellerOrder[] }) {
    const metrics = useTodayMetrics('seller', orders, receipts);
    return <span>{metrics?.orders ?? 'unavailable'}</span>;
  }
  const reply = (orders: number) => new Response(JSON.stringify({date: '2026-10-31',
    timezone: 'Asia/Dhaka', orders, confirmed: 1, awaiting: 0, pending: 0, payments: 2}));
  await act(async () => root.render(<Harness orders={[]} />));
  await act(async () => root.render(<Harness orders={[baseOrder]} />));
  await act(async () => pending[1](reply(42)));
  expect(host.textContent).toBe('42');
  await act(async () => pending[0](reply(5)));
  expect(host.textContent).toBe('42');
  expect(fetcher.mock.calls.every(([url]) => url === '/api/seller/metrics/today')).toBe(true);
  await act(async () => window.dispatchEvent(new Event('focus')));
  await act(async () => pending[2](new Response('{}', {status: 500})));
  expect(host.textContent).toBe('unavailable');
  await act(async () => root.unmount()); host.remove();
});
