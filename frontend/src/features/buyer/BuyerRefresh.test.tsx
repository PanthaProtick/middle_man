import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BuyerPortal } from './BuyerPortal';
import type { PublicOrder } from './types';

const pending: PublicOrder = {
  id: 'synthetic', shop_display_name: 'Synthetic shop', product_name: 'Test product',
  total_minor: 350000, required_advance_minor: 50000, expected_cod_minor: 300000,
  actual_cod_minor: null, account_provider: 'bkash', account_receiving_number: '01711111111',
  account_label: 'Synthetic', lifecycle: 'pending', status_message: 'Pending',
  submission_acknowledgement: 'ACK-test', created_at: '2026-10-20T00:00:00Z',
  expires_at: '2026-10-22T00:00:00Z', completed_at: null,
};
const response = (order: PublicOrder = pending) => new Response(JSON.stringify(order));
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}
async function visibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
}
async function mount() {
  await act(async () => root.render(<BuyerPortal portalToken="synthetic" />));
}
function refreshButton() {
  return Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Refresh Status'));
}

it('pauses hidden pending pages and resumes a single loop until confirmation', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response());
  await mount();
  await visibility('hidden');
  await advance(90000);
  expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockResolvedValueOnce(response({ ...pending, lifecycle: 'confirmed', actual_cod_minor: 280000 }));
  await visibility('visible');
  expect(container.textContent).toContain('Order Confirmed');
  expect(container.textContent).toContain('৳2,800.00');
  await advance(120000);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('aborts a hidden request and ignores its late pending response after a manual confirmation', async () => {
  let resolveLate: (value: Response) => void = () => { throw new Error('Request not started'); };
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response())
    .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveLate = resolve; }))
    .mockResolvedValueOnce(response({ ...pending, lifecycle: 'confirmed', actual_cod_minor: 270000 }));
  await mount();
  await advance(30000);
  const signal = fetch.mock.calls[1][1]?.signal;
  await visibility('hidden');
  expect(signal?.aborted).toBe(true);
  await visibility('visible');
  await act(async () => resolveLate(response()));
  expect(container.textContent).toContain('Order Confirmed');
  expect(container.textContent).not.toContain('Pending Seller Review');
  await advance(300000);
  expect(fetch).toHaveBeenCalledTimes(3);
});

it('shows refresh loading, prevents overlapping reads, and stops after manual rejection', async () => {
  let finish: (value: Response) => void = () => { throw new Error('Request not started'); };
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response())
    .mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
  await mount();
  const button = refreshButton();
  await act(async () => button?.click());
  expect(button?.disabled).toBe(true);
  expect(container.textContent).toContain('Checking');
  await advance(10000);
  expect(fetch).toHaveBeenCalledTimes(2);
  await act(async () => finish(response({ ...pending, lifecycle: 'rejected' })));
  expect(container.textContent).toContain('Order Declined');
  expect(container.textContent).toContain('contact the seller');
  expect(container.querySelector('form')).toBeNull();
  await advance(300000);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('backs off rate limits and outages to at most five minutes and resets after recovery', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response())
    .mockImplementation(async () => new Response('{}', { status: 429 }));
  await mount();
  await advance(30000);
  expect(container.textContent).toContain('Unable to refresh');
  expect(container.textContent).toContain('Pending Seller Review');
  for (const delay of [60000, 120000, 240000, 300000, 300000]) {
    const count = fetch.mock.calls.length;
    await advance(delay - 1);
    expect(fetch).toHaveBeenCalledTimes(count);
    await advance(1);
    expect(fetch).toHaveBeenCalledTimes(count + 1);
  }
  fetch.mockResolvedValueOnce(response());
  await act(async () => refreshButton()?.click());
  expect(container.textContent).not.toContain('Unable to refresh');
  const count = fetch.mock.calls.length;
  await advance(30000);
  expect(fetch).toHaveBeenCalledTimes(count + 1);
});

it.each([404, 410, 403])('clears the last projection and stops on unavailable/denied record %s', async (status) => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response())
    .mockResolvedValueOnce(new Response('{}', { status }));
  await mount();
  await advance(30000);
  expect(container.textContent).toContain('Order record unavailable');
  expect(container.textContent).not.toContain('Test product');
  await advance(600000);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('enforces a policy denial received during polling', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response())
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: {
      code: 'PUBLIC_ACCESS_POLICY_UNSETTLED', message: 'Private internal details',
    } }), { status: 503 }));
  await mount();
  await advance(30000);
  expect(container.textContent).toContain('Public Access Disabled');
  expect(container.textContent).not.toContain('Private internal details');
  expect(container.textContent).not.toContain('Test product');
  await advance(600000);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('pauses offline and refreshes once on reconnection without expiring submitted orders', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response());
  await mount();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await act(async () => window.dispatchEvent(new Event('offline')));
  expect(container.textContent).toContain('offline');
  await advance(300000);
  expect(fetch).toHaveBeenCalledTimes(1);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  await act(async () => window.dispatchEvent(new Event('online')));
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain('Pending Seller Review');
  expect(container.textContent).not.toContain('Order Link Expired');
  expect(container.textContent).toContain('Submitted orders do not expire automatically');
  expect(container.textContent).not.toContain('Valid until');
});

it('cancels unmounted reads and never starts another poll', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response())
    .mockImplementationOnce(() => new Promise<Response>(() => {}));
  await mount();
  await advance(30000);
  await act(async () => root.render(<div>Left page</div>));
  expect(fetch.mock.calls[1][1]?.signal?.aborted).toBe(true);
  await advance(600000);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('bounds a stalled read and offers manual retry after the timeout', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response())
    .mockImplementationOnce((_url, options) => new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
  await mount();
  await act(async () => refreshButton()?.click());
  await advance(15000);
  expect(fetch.mock.calls[1][1]?.signal?.aborted).toBe(true);
  expect(container.textContent).toContain('Unable to refresh');
  expect(refreshButton()?.disabled).toBe(false);
  fetch.mockResolvedValueOnce(response({ ...pending, lifecycle: 'cancelled' }));
  await act(async () => refreshButton()?.click());
  expect(container.textContent).toContain('Order Cancelled');
});

it('ignores a late response belonging to a different portal token', async () => {
  let late: (value: Response) => void = () => { throw new Error('Not started'); };
  const fetch = vi.spyOn(globalThis, 'fetch')
    .mockImplementationOnce(() => new Promise<Response>((resolve) => { late = resolve; }))
    .mockResolvedValueOnce(response({ ...pending, product_name: 'Second order', lifecycle: 'expired' }));
  await mount();
  expect(container.textContent).toContain('Loading order details');
  await act(async () => root.render(<BuyerPortal portalToken="second" />));
  expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
  await act(async () => late(response()));
  expect(container.textContent).toContain('Second order');
  expect(container.textContent).toContain('Order Link Expired');
  expect(container.textContent).not.toContain('Pending Seller Review');
  await advance(600000);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('does not let a late submission reopen a newer public-policy denial', async () => {
  let submitted: (value: Response) => void = () => { throw new Error('Not submitted'); };
  vi.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(response({ ...pending, lifecycle: 'awaiting_buyer' }))
    .mockResolvedValueOnce(new Response(JSON.stringify({condition: 'disconnected', choices: []})))
    .mockImplementationOnce(() => new Promise<Response>((resolve) => { submitted = resolve; }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: {
      code: 'PUBLIC_ACCESS_POLICY_UNSETTLED', message: 'Access disabled',
    } }), { status: 503 }));
  await mount();
  await act(async () => {
    for (const [name, value] of Object.entries({ buyer_name: 'Synthetic Buyer', contact_number: '01711111111',
      address_raw: 'Synthetic address Dhaka', payment_sender: '01822222222', payment_trx_id: 'SYNTH123' })) {
      const input = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
      if (!input) throw new Error(`Missing field ${name}`);
      const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await act(async () => container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await visibility('hidden');
  await visibility('visible');
  expect(container.textContent).toContain('Public Access Disabled');
  await act(async () => submitted(response()));
  expect(container.textContent).toContain('Public Access Disabled');
  expect(container.textContent).not.toContain('Pending Seller Review');
});
