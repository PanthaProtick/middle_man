import { afterEach, expect, it, vi } from 'vitest';
import { requestJson } from './api';
import { bindSellerSession, renewSellerSessionToken, sellerFetch } from './sessionRequest';

let dispose: (() => void) | undefined;
afterEach(() => { dispose?.(); vi.unstubAllGlobals(); });

it('renews authorization without invalidating a same-session response already in flight', async () => {
  let deliver!: (response: Response) => void;
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { deliver = resolve; }))
    .mockImplementation(async () => Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetcher);
  dispose = bindSellerSession('alpha', vi.fn());
  const pending = requestJson('/api/seller/shop', {}, 'alpha');
  renewSellerSessionToken('alpha', 'renewed-alpha');
  deliver(Response.json({ display_name: 'Alpha' }));
  await expect(pending).resolves.toEqual({ display_name: 'Alpha' });
  await sellerFetch('/api/seller/shop', {}, 'alpha');
  expect(fetcher).toHaveBeenLastCalledWith('/api/seller/shop', expect.objectContaining({
    headers: { Authorization: 'Bearer renewed-alpha' },
  }));
  dispose();
  dispose = bindSellerSession('beta', vi.fn());
  renewSellerSessionToken('alpha', 'late-alpha');
  await sellerFetch('/api/seller/shop', {}, 'beta');
  expect(fetcher).toHaveBeenLastCalledWith('/api/seller/shop', expect.objectContaining({
    headers: { Authorization: 'Bearer beta' },
  }));
});

it('rejects a body delivered after the request session is invalidated', async () => {
  let deliver!: (value: Uint8Array) => void;
  let finish!: () => void;
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    deliver = value => controller.enqueue(value);
    finish = () => controller.close();
  } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
  dispose = bindSellerSession('alpha', vi.fn());
  const pending = requestJson('/api/seller/shop', {}, 'alpha');
  const result = expect(pending).rejects.toThrow('Seller session changed');
  await Promise.resolve();
  dispose();
  dispose = bindSellerSession('beta', vi.fn());
  deliver(new TextEncoder().encode('{"private":"alpha"}'));
  finish();
  await result;
});

it('does not treat database unavailability as a session failure', async () => {
  const failed = vi.fn();
  dispose = bindSellerSession('alpha', failed);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    error: { code: 'DATABASE_UNAVAILABLE', message: 'Retry storage' },
  }), { status: 503 })));
  await expect(requestJson('/api/seller/shop', {}, 'alpha')).rejects.toMatchObject({
    status: 503, code: 'DATABASE_UNAVAILABLE',
  });
  expect(failed).not.toHaveBeenCalled();
});

it('clears the workspace on unauthorized headers even when the body stalls', async () => {
  const failed = vi.fn();
  dispose = bindSellerSession('alpha', failed);
  let close!: () => void;
  const body = new ReadableStream({ start(controller) { close = () => controller.close(); } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 401 })));
  const pending = sellerFetch('/api/seller/shop', {}, 'alpha');
  const result = expect(pending).rejects.toThrow('sign in again');
  await Promise.resolve();
  const notified = failed.mock.calls.length;
  close();
  await result;
  expect(notified).toBe(1);
});

it.each(['not_yet_valid', 'untrusted-private-text'])(
  'reports only an allowlisted header diagnostic while clearing the session: %s', async reason => {
    const failed = vi.fn();
    dispose = bindSellerSession('alpha', failed);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', {
      status: 401, headers: { 'X-Seller-Auth-Reason': reason },
    })));
    await expect(sellerFetch('/api/seller/shop', {}, 'alpha')).rejects.toThrow('sign in again');
    if (reason === 'not_yet_valid') expect(failed).toHaveBeenCalledWith('unauthorized', reason);
    else expect(failed).toHaveBeenCalledWith('unauthorized');
  },
);

it.each(['/api/seller/evidence/private', '/api/seller/orders/export'])(
  'invalidates the seller session for binary request %s', async url => {
    const failed = vi.fn();
    dispose = bindSellerSession('alpha', failed);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(sellerFetch(url, {}, 'alpha')).rejects.toThrow('sign in again');
    expect(failed).toHaveBeenCalledWith('unauthorized');
  },
);
