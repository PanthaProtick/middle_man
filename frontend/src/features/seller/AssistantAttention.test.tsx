import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { AssistantWorkspace } from './AssistantWorkspace';
import { fetchAttentionPreview } from './workQueryApi';

vi.mock('./workQueryApi', () => ({
  fetchAttentionPreview: vi.fn(),
  fetchPreparationPreview: vi.fn(),
}));

const preview = {
  query: 'attention' as const,
  items: [{
    order: {
      id: 'attention-order-1', shop_id: 'shop-1', payment_account_id: 'acc-1', product_name: 'Bag',
      total_minor: 1000, required_advance_minor: 200, expected_cod_minor: 800, actual_cod_minor: 700,
      account_provider: 'bkash' as const, account_receiving_number: '017', account_label: 'Main',
      lifecycle: 'pending' as const, version: 1, review_reasons: [], buyer_revision: 1,
      allocation_basis: 'automatic', portal_token: 'token', portal_url: '/orders/token',
      created_at: '2026-10-30T06:00:00Z', updated_at: '2026-10-30T06:00:00Z',
      expires_at: '2026-11-01T06:00:00Z', completed_at: null,
    },
    category: 'failed_submission' as const,
    reason_codes: ['FAILED_SUBMISSION' as const],
  }],
  total: 1,
  next_cursor: null,
  retrieved_at: '2026-11-01T06:00:00Z',
  calendar_date: '2026-11-01',
  timezone: 'Asia/Dhaka' as const,
};

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  localStorage.clear();
});

async function open() {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const onShowInDashboard = vi.fn();
  await act(async () => root.render(
    <LocaleProvider>
      <AssistantWorkspace floating token="seller-token" onShowInDashboard={onShowInDashboard}>
        <p>Orders</p>
      </AssistantWorkspace>
    </LocaleProvider>,
  ));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="seller-assistant-launcher"]')!.click());
  const choice = (label: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('.assistant-workflow-choices button'))
    .find(item => item.textContent === label)!;
  return { host, root, choice, onShowInDashboard };
}

it('runs the shared attention query from the workflow button and keeps an unfinished draft', async () => {
  vi.mocked(fetchAttentionPreview).mockResolvedValue(preview);
  const { host, root, choice, onShowInDashboard } = await open();

  await act(async () => choice('New order').click());
  expect(host.querySelector('[name="assistant-draft"]')).not.toBeNull();

  await act(async () => choice('Orders needing attention').click());
  await act(async () => { await Promise.resolve(); });

  expect(fetchAttentionPreview).toHaveBeenCalledWith({ cursor: undefined, limit: 10 }, 'seller-token');
  expect(host.querySelector('[role="log"] [data-testid="attention-order"]')).not.toBeNull();
  expect(host.textContent).toContain('Showing 1 of 1');
  expect(host.textContent).toContain('Courier submission failed');
  expect(host.querySelector('[data-testid="attention-order"]')).not.toBeNull();
  expect(host.querySelector('[name="assistant-draft"]')).toBeNull();
  expect(host.querySelector('.assistant-draft-status')).not.toBeNull();

  const show = Array.from(host.querySelectorAll('button')).find(item => item.textContent === 'Show in dashboard')!;
  await act(async () => show.click());
  expect(onShowInDashboard).toHaveBeenCalledWith('attention');
  await act(async () => root.unmount());
});

it.each([
  'attention dorkar emon order',
  'যে অর্ডারে নজর দিতে হবে',
  'show outstanding work',
])('recognizes %s locally and retrieves the attention preview', async message => {
  vi.mocked(fetchAttentionPreview).mockResolvedValue(preview);
  const { host, root } = await open();
  const input = host.querySelector<HTMLTextAreaElement>('[name="assistant-message"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, message);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await act(async () => { await Promise.resolve(); });

  expect(fetchAttentionPreview).toHaveBeenCalledOnce();
  expect(host.querySelector('[data-testid="attention-order"]')?.textContent).toContain('attention-order-1');
  await act(async () => root.unmount());
});
