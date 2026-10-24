import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { OrderExport } from './OrderExport';
import { OrderList } from './OrderList';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

it('copies an authenticated summary with labelled balances and reports clipboard failure', async () => {
  const writeText = vi.fn().mockRejectedValue(new Error('Clipboard denied'));
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    order_id: 'order-1', product: 'Bag', lifecycle: 'confirmed', buyer_name: 'Buyer',
    contact_number: '01711111111', address: 'Dhaka', total_bdt: '100.00',
    required_advance_bdt: '20.00', accepted_advance_bdt: '30.00',
    expected_cod_bdt: '80.00', actual_cod_bdt: '70.00', purpose: 'Manual delivery aid only',
  })));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<OrderExport orderId="order-1" token="seller-token" />));
  await act(async () => host.querySelector('button')!.click());
  expect(host.textContent).toContain('Clipboard denied');
  expect(host.textContent).not.toContain('Summary copied');
  expect(writeText.mock.calls[0][0]).toContain('Actual COD: BDT 70.00');
  expect(writeText.mock.calls[0][0]).toContain('Accepted advance: BDT 30.00');
  expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer seller-token' });
  await act(async () => root.unmount());
});

it('uses the selected status and reports empty exports without downloading', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('header\r\n', {
    headers: { 'X-Export-Count': '0' },
  }));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<OrderExport status="confirmed" />));
  await act(async () => host.querySelector('button')!.click());
  expect(fetcher.mock.calls[0][0]).toBe('/api/seller/orders/export?status=confirmed');
  expect(host.textContent).toContain('No orders match');
  await act(async () => root.unmount());
});

it('shows progress, downloads a CSV blob, and reports service errors', async () => {
  const createObjectURL = vi.fn().mockReturnValue('blob:export');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = createObjectURL;
    static revokeObjectURL = revokeObjectURL;
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  let finish: (response: Response) => void = () => {};
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<OrderExport token="seller-token" />));
  await act(async () => host.querySelector('button')!.click());
  expect(host.querySelector('button')!.disabled).toBe(true);
  expect(host.textContent).toContain('Preparing');
  await act(async () => finish(new Response('"order_id"\r\n"one"', { headers: { 'X-Export-Count': '1' } })));
  expect(host.textContent).toContain('CSV download started');
  expect(click).toHaveBeenCalledOnce();
  expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
  fetcher.mockResolvedValue(new Response(JSON.stringify({error: {message: 'Export unavailable. Please retry.'}}), {status: 503}));
  await act(async () => host.querySelector('button')!.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Export unavailable');
  await act(async () => root.unmount());
});

it('clears stale empty-export feedback when the order lifecycle filter changes', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('header\r\n', {
    headers: { 'X-Export-Count': '0' },
  }));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const render = (status: string) => root.render(<OrderList orders={[]} statusFilter={status}
    onFilterChange={() => {}} nextCursor={null} onLoadMore={() => {}} />);
  await act(async () => render('pending'));
  await act(async () => host.querySelector('button')!.click());
  expect(host.textContent).toContain('No orders match this filter');
  await act(async () => render('confirmed'));
  expect(host.textContent).not.toContain('No orders match this filter');
  await act(async () => root.unmount());
});
