import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { EvidenceResolution } from './EvidenceResolution';

const comparison = {
  receipt: {id: 'receipt', version: 2, reconciliation_state: 'conflicted', has_conflict: true,
    observations: [{id: 'obs', source: 'manual', payment_account_id: 'account', amount_minor: 200000,
      sender_number_canonical: '01822222222', occurred_at: '2026-10-23T12:00:00Z', parse_state: 'valid'}]},
  claims: [{order_id: 'order-a', revision_id: 'rev-a', buyer_name: 'Buyer A', lifecycle: 'pending',
    sender_number: '01822222222', amount_minor: 200000, review_reasons: ['COMPETING_CLAIMS'], held_by_resolution: false},
    {order_id: 'order-b', revision_id: 'rev-b', buyer_name: 'Buyer B', lifecycle: 'pending',
    sender_number: '01833333333', amount_minor: 200000, review_reasons: ['SENDER_MISMATCH'], held_by_resolution: false}],
  allocated_order_id: null, history: [],
};

afterEach(() => vi.restoreAllMocks());
async function mount() {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<EvidenceResolution receiptId="receipt" token="seller" onResolved={() => {}} />));
  async function change(label: string, value: string) {
    await act(async () => {
      const node = container.querySelector<HTMLSelectElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!;
      if (node.tagName === 'SELECT') { node.value = value; node.dispatchEvent(new Event('change', {bubbles: true})); }
      else {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(node, value);
        node.dispatchEvent(new Event('input', {bubbles: true}));
      }
    });
  }
  const submit = async () => act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true})); });
  const cleanup = async () => { await act(async () => root.unmount()); container.remove(); };
  return {container, change, submit, cleanup};
}

it('compares claims and retains the identical decision after an unknown outcome', async () => {
  const requests: RequestInit[] = [];
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(comparison)))
    .mockImplementationOnce(async (_url, init) => { requests.push(init!); throw new Error('Connection lost'); })
    .mockImplementationOnce(async (_url, init) => { requests.push(init!); return new Response(JSON.stringify({
      ...comparison, allocated_order_id: 'order-a',
    })); });
  const ui = await mount();
  expect(ui.container.textContent).toContain('Buyer A');
  expect(ui.container.textContent).toContain('SENDER_MISMATCH');
  await ui.change('Received observation', 'obs');
  await ui.change('Claim decision', 'order-a');
  expect(ui.container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  await ui.change('Decision reason', 'Checked both buyers');
  await ui.submit();
  expect(ui.container.querySelector('[role="alert"]')?.textContent).toContain('Connection lost');
  expect(ui.container.textContent).toContain('Retry same decision');
  await ui.submit();
  expect(ui.container.textContent).toContain('Accepted allocation: order-a');
  expect(requests[0]?.body).toBe(requests[1]?.body);
  expect(requests[0]?.headers).toEqual(requests[1]?.headers);
  expect(ui.container.querySelector('form')).toBeNull();
  await ui.cleanup();
});

it('refetches stale evidence before allowing a new decision', async () => {
  const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(comparison)))
    .mockResolvedValueOnce(new Response(JSON.stringify({error: {code: 'STALE_VERSION', message: 'Refetch evidence'}}), {status: 409}))
    .mockResolvedValueOnce(new Response(JSON.stringify({...comparison, receipt: {...comparison.receipt, version: 3}})));
  const ui = await mount();
  await ui.change('Received observation', 'obs');
  await ui.change('Decision reason', 'Reviewed');
  await ui.submit();
  expect(spy).toHaveBeenCalledTimes(3);
  expect(ui.container.querySelector('[role="alert"]')?.textContent).toContain('Refetch evidence');
  expect(ui.container.querySelector<HTMLSelectElement>('[aria-label="Received observation"]')!.value).toBe('');
  await ui.cleanup();
});

it('shows loading and permission failure without enabling a decision', async () => {
  let finish: (response: Response) => void = () => {};
  vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
  const ui = await mount();
  expect(ui.container.textContent).toContain('Loading evidence comparison');
  await act(async () => finish(new Response(JSON.stringify({error: {code: 'UNAUTHORIZED', message: 'Seller sign-in required'}}), {status: 401})));
  expect(ui.container.querySelector('[role="alert"]')?.textContent).toContain('Seller sign-in required');
  expect(ui.container.querySelector('form')).toBeNull();
  await ui.cleanup();
});
