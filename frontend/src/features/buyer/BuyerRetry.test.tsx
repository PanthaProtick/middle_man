import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { BuyerPortal } from './BuyerPortal';

const order = {
  id: 'synthetic-order', shop_display_name: 'Synthetic shop', product_name: 'Synthetic product',
  total_minor: 30000, required_advance_minor: 10000, expected_cod_minor: 20000,
  account_provider: 'bkash', account_receiving_number: '01711111111', account_label: 'Synthetic',
  lifecycle: 'awaiting_buyer', created_at: '2026-10-23T00:00:00Z', expires_at: '2026-10-25T00:00:00Z',
};

it.each([413, 429])('keeps input editable and renders admission rejection %s', async (status) => {
  const message = status === 429 ? 'Too many requests. Retry after 10 seconds.'
    : 'Request is too large. Reduce the request or screenshot size and retry.';
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) =>
    init?.method === 'POST'
      ? new Response(JSON.stringify({ error: { code: status === 429 ? 'PUBLIC_RATE_LIMITED' : 'PUBLIC_BODY_TOO_LARGE', message } }), { status })
      : new Response(JSON.stringify(order)));
  const page = await filledPortal();
  try {
    await page.submit();
    expect(page.container.textContent).toContain(message);
    expect(page.container.querySelector<HTMLInputElement>('[name="buyer_name"]')?.value).toBe('Synthetic buyer');
    expect(page.container.querySelector('fieldset')?.disabled).toBe(false);
    expect(page.container.textContent).not.toContain('ACK-');
  } finally { await page.close(); }
});

function edit(container: HTMLElement, name: string, value: string) {
  const input = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)!;
  const prototype = input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function filledPortal() {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<BuyerPortal portalToken="synthetic" />));
  await act(async () => {
    edit(container, 'buyer_name', 'Synthetic buyer');
    edit(container, 'contact_number', '01711111111');
    edit(container, 'address_raw', 'Synthetic address');
    edit(container, 'payment_sender', '01822222222');
    edit(container, 'payment_trx_id', 'SYNTHETIC');
  });
  return {
    container,
    submit: () => act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }),
    close: async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); },
  };
}

it('retries the frozen payload and key after an unknown outcome', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    if (init?.method === 'POST') throw new TypeError('Synthetic lost response');
    return new Response(JSON.stringify(order));
  });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<BuyerPortal portalToken="synthetic" />));
    await act(async () => {
      edit(container, 'buyer_name', 'First reviewed name');
      edit(container, 'contact_number', '01711111111');
      edit(container, 'address_raw', 'Synthetic address');
      edit(container, 'payment_sender', '01822222222');
      edit(container, 'payment_trx_id', 'SYNTHETIC');
    });
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(container.textContent).not.toContain('ACK-');
    // Even programmatic changes cannot turn an unknown write into a different attempt.
    await act(async () => edit(container, 'buyer_name', 'Changed after lost response'));
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[1][1]?.body).toBe(posts[0][1]?.body);
    expect(posts[1][1]?.headers).toEqual(posts[0][1]?.headers);
    expect(container.querySelector('fieldset')?.disabled).toBe(true);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  }
});

it('retains courier IDs, written directions and independent payment claim on retry', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method === 'POST') throw new TypeError('Synthetic lost response');
    if (String(url).includes('/pathao-locations')) {
      const path = String(url);
      const choices = path.includes('zone_id=10') ? [{id: 100, name: 'Area', home_delivery_available: true}]
        : path.includes('city_id=1') ? [{id: 10, name: 'Zone'}] : [{id: 1, name: 'Dhaka'}];
      return new Response(JSON.stringify({condition: 'resolved', simulated: true, choices}));
    }
    return new Response(JSON.stringify(order));
  });
  const page = await filledPortal();
  try {
    for (const [name, value] of [['city', '1'], ['zone', '10'], ['area', '100']]) {
      await act(async () => {
        const select = page.container.querySelector<HTMLSelectElement>(`select[name="pathao_${name}"]`)!;
        select.value = value;
        select.dispatchEvent(new Event('change', {bubbles: true}));
      });
    }
    await page.submit();
    await page.submit();
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[1][1]?.body).toEqual(posts[0][1]?.body);
    expect(posts[1][1]?.headers).toEqual(posts[0][1]?.headers);
    expect(JSON.parse(String(posts[0][1]?.body))).toMatchObject({
      contact_number: '01711111111', address: {raw_text: 'Synthetic address', pathao: {city_id: 1, zone_id: 10, area_id: 100}},
      payment_claim: {trx_id: 'SYNTHETIC', sender_number: '01822222222'},
    });
  } finally { await page.close(); }
});

it('reconciles a lost response to saved pending status without another submission', async () => {
  let submitted = false;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    if (init?.method === 'POST') { submitted = true; throw new TypeError('Response lost after commit'); }
    return new Response(JSON.stringify(submitted ? { ...order, lifecycle: 'pending', submission_acknowledgement: 'ACK-SAVED' } : order));
  });
  const page = await filledPortal();
  try {
    await page.submit();
    expect(page.container.textContent).toContain('ACK-SAVED');
    expect(page.container.querySelector('form')).toBeNull();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  } finally { await page.close(); }
});

it('preserves input and shows server field validation before allowing a corrected attempt', async () => {
  let postCount = 0;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    if (init?.method !== 'POST') return new Response(JSON.stringify(order));
    postCount++;
    return postCount === 1
      ? new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Please correct the details', fields: [{ field: 'payment_claim.trx_id', code: 'synthetic', message: 'Synthetic TrxID validation' }] } }), { status: 422 })
      : new Response(JSON.stringify({ ...order, lifecycle: 'pending', submission_acknowledgement: 'ACK-CORRECTED' }));
  });
  const page = await filledPortal();
  try {
    await page.submit();
    expect(page.container.querySelector<HTMLInputElement>('[name="buyer_name"]')?.value).toBe('Synthetic buyer');
    expect(page.container.querySelector('fieldset')?.disabled).toBe(false);
    expect(page.container.querySelector('#payment_trx_id-error')?.textContent).toBe('Synthetic TrxID validation');
    await act(async () => edit(page.container, 'payment_trx_id', 'CORRECTED'));
    await page.submit();
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts[1][1]?.headers).not.toEqual(posts[0][1]?.headers);
    expect(page.container.textContent).toContain('ACK-CORRECTED');
  } finally { await page.close(); }
});

it.each([413, 429])('preserves uncertain attempt after admission rejection %s', async (status) => {
  vi.useFakeTimers();
  let reads = 0;
  let posts = 0;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    if (init?.method === 'POST') {
      posts++;
      if (posts === 2) return new Response(JSON.stringify({ error: { code: 'PUBLIC_ADMISSION_REJECTED', message: 'Retry after 10 seconds.' } }), { status });
      if (posts > 2) return new Response(JSON.stringify({ ...order, lifecycle: 'pending', submission_acknowledgement: 'ACK-RETRY' }));
    } else if (++reads === 1) return new Response(JSON.stringify(order));
    else if (posts === 2) throw new TypeError('Status still unavailable');
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true });
    });
  });
  const page = await filledPortal();
  try {
    await act(async () => { page.container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(page.container.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(page.container.querySelector('button[type="submit"]')?.hasAttribute('disabled')).toBe(false);
    expect(page.container.querySelector('fieldset')?.disabled).toBe(true);
    await page.submit();
    const attempts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(attempts).toHaveLength(2);
    expect(attempts[1][1]?.body).toBe(attempts[0][1]?.body);
    expect(attempts[1][1]?.headers).toEqual(attempts[0][1]?.headers);
    expect(page.container.querySelector('fieldset')?.disabled).toBe(true);
    expect(page.container.textContent).toContain('Retry after 10 seconds.');
    await page.submit();
    const finalAttempt = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')[2];
    expect(finalAttempt[1]?.body).toBe(attempts[0][1]?.body);
    expect(finalAttempt[1]?.headers).toEqual(attempts[0][1]?.headers);
    expect(page.container.textContent).toContain('ACK-RETRY');
  } finally { await page.close(); vi.useRealTimers(); }
});
