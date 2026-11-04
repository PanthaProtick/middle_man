import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { fetchHealth } from './api';
import { fetchShop } from '../features/seller/api';
import { bindSellerSession } from '../features/seller/sessionRequest';
import { fetchPublicOrder, submitBuyerDetails } from '../features/buyer/api';
import { useLocationCatalog } from '../features/buyer/useLocationCatalog';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('routes authenticated shop reads and token-refresh retries to the configured API', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/api/');
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response('{}', {
      status: 401, headers: { 'X-Seller-Auth-Reason': 'expired' },
    }))
    .mockResolvedValueOnce(Response.json({ shop: null }));
  vi.stubGlobal('fetch', fetcher);
  const dispose = bindSellerSession('old', vi.fn(), async () => 'fresh');
  try {
    await expect(fetchShop('old')).resolves.toEqual({ shop: null });
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [url] of fetcher.mock.calls) expect(url).toBe('https://api.example.test/api/seller/shop');
    expect(fetcher).toHaveBeenLastCalledWith('https://api.example.test/api/seller/shop',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fresh' }) }));
  } finally { dispose(); }
});

it('routes buyer status and submissions to the API while preserving retry protection', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/api');
  const fetcher = vi.fn().mockImplementation(async () => Response.json({ status: 'open' }));
  vi.stubGlobal('fetch', fetcher);
  await fetchPublicOrder('link/a');
  await submitBuyerDetails('link/a', {
    buyer_name: 'Demo Buyer', contact_number: '01700000000',
    address: { raw_text: 'Synthetic address' },
    payment_claim: { provider: 'bkash', trx_id: 'DEMO123', sender_number: '01700000000', amount_minor: 100 },
  }, 'submission-key');
  expect(fetcher).toHaveBeenNthCalledWith(1, 'https://api.example.test/api/public/orders/link%2Fa',
    expect.objectContaining({ method: 'GET', cache: 'no-store', signal: expect.any(AbortSignal) }));
  expect(fetcher).toHaveBeenNthCalledWith(2, 'https://api.example.test/api/public/orders/link%2Fa/submission',
    expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'Idempotency-Key': 'submission-key' }) }));
});

it('routes buyer location lookups to the API without changing privacy or cancellation options', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/api');
  const fetcher = vi.fn().mockResolvedValue(Response.json({
    condition: 'resolved', catalog_version: 'v1', choices: [],
  }));
  vi.stubGlobal('fetch', fetcher);
  const container = document.createElement('div');
  const root = createRoot(container);
  function Probe() { useLocationCatalog('link/a', {}); return null; }
  try {
    await act(async () => { root.render(<Probe />); });
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/api/public/orders/link%2Fa/pathao-locations',
      expect.objectContaining({ cache: 'no-store', referrerPolicy: 'no-referrer', signal: expect.any(AbortSignal) }));
  } finally { await act(async () => { root.unmount(); }); }
});

it('keeps local seller and buyer requests on the development proxy when no API base is set', async () => {
  vi.stubEnv('VITE_API_BASE_URL', '');
  const fetcher = vi.fn().mockImplementation(async () => Response.json({}));
  vi.stubGlobal('fetch', fetcher);
  await fetchShop('local');
  await fetchPublicOrder('link');
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/seller/shop', '/api/public/orders/link']);
});

it('uses the configured API for health checks as well as product workflows', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/api/');
  const fetcher = vi.fn().mockResolvedValue(Response.json({ status: 'healthy' }));
  vi.stubGlobal('fetch', fetcher);
  await fetchHealth();
  expect(fetcher).toHaveBeenCalledWith('https://api.example.test/api/health', expect.anything());
});
