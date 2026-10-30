import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { ReviewAssistant } from './ReviewAssistant';
import { baseOrder } from './reviewAssistanceTestSupport';
import type {
  AutomaticReviewReason,
  ReviewAssistanceResponse,
  ReviewFacts,
  ReviewProviderContext,
  SuggestedAction,
} from './reviewAssistanceApi';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.innerHTML = '';
});

function makeResponse(overrides: Partial<ReviewAssistanceResponse>): ReviewAssistanceResponse {
  const condition = overrides.condition ?? 'NO_RECORDED_RECEIPT';
  const facts = overrides.facts ?? { has_matching_receipt: false };
  const reason_codes = overrides.reason_codes ?? [];
  const actions = overrides.suggested_actions ?? [];
  const context: ReviewProviderContext = {
    condition,
    reason_codes,
    unknown_reason_present: overrides.unknown_reason_present ?? false,
    locale: overrides.locale ?? 'en',
    facts,
    permitted_actions: actions.map(action => action.action_id),
  };
  return {
    order_id: baseOrder.id,
    order_version: 1,
    buyer_revision: 1,
    lifecycle: 'pending',
    source: 'local',
    condition,
    context_token: 'context-1',
    reason_codes,
    unknown_reason_present: false,
    explanation: 'Local explanation.',
    suggested_actions: actions,
    facts,
    context,
    locale: 'en',
    ...overrides,
  };
}

async function renderAdvice(response: ReviewAssistanceResponse, withLocaleSwitch = false) {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () => new Response(JSON.stringify(response), { status: 200 }),
  );
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <LocaleProvider>
        {withLocaleSwitch ? <LocaleSwitch /> : null}
        <ReviewAssistant order={baseOrder} token="test-token" />
      </LocaleProvider>,
    );
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('[data-testid="ask-ai-button"]')!.click();
  });
  return { container, root, fetchSpy };
}

const cases: Array<{
  condition: AutomaticReviewReason;
  explanation: string;
  facts: ReviewFacts;
  factTestId: string;
  factText: string;
  actions: SuggestedAction[];
}> = [
  {
    condition: 'SENDER_MISMATCH',
    explanation: 'The sender number on the recorded payment is different.',
    facts: { has_matching_receipt: true, sender_status: 'different' },
    factTestId: 'review-fact-sender',
    factText: 'Different from the claimed sender',
    actions: [
      { action_id: 'CHECK_TRANSACTIONS', label: 'Check transactions', target: 'transactions' },
      { action_id: 'CORRECT_BUYER_DETAILS', label: 'Correct buyer details', target: 'buyer_tab' },
    ],
  },
  {
    condition: 'AMOUNT_MISMATCH',
    explanation: 'The amounts do not match.',
    facts: {
      has_matching_receipt: true, required_advance_minor: 200_000,
      claimed_amount_minor: 200_000, received_amount_minor: 150_000, currency: 'BDT',
    },
    factTestId: 'review-fact-received-amount',
    factText: '৳1,500.00',
    actions: [
      { action_id: 'CHECK_TRANSACTIONS', label: 'Check transactions', target: 'transactions' },
      { action_id: 'CORRECT_BUYER_DETAILS', label: 'Correct buyer details', target: 'buyer_tab' },
    ],
  },
  {
    condition: 'TIME_UNCLEAR',
    explanation: 'The recorded payment time is before the order was created.',
    facts: { has_matching_receipt: true, time_status: 'before_order_creation' },
    factTestId: 'review-fact-payment-time',
    factText: 'Before the order was created',
    actions: [
      { action_id: 'CHECK_TRANSACTIONS', label: 'Check transactions', target: 'transactions' },
      { action_id: 'CORRECT_BUYER_DETAILS', label: 'Correct buyer details', target: 'buyer_tab' },
    ],
  },
  {
    condition: 'WRONG_RECEIVING_ACCOUNT',
    explanation: 'The payment went to a different account.',
    facts: { has_matching_receipt: true, receiving_account_comparison: 'different' },
    factTestId: 'review-fact-receiving-account',
    factText: 'Different from the order account',
    actions: [
      { action_id: 'CHECK_TRANSACTIONS', label: 'Check transactions', target: 'transactions' },
      { action_id: 'CORRECT_BUYER_DETAILS', label: 'Correct buyer details', target: 'buyer_tab' },
    ],
  },
  {
    condition: 'CONFLICTING_RECEIPTS',
    explanation: 'Conflicting receipts were recorded.',
    facts: { has_matching_receipt: true, conflict_categories: ['amount', 'sender'] },
    factTestId: 'review-fact-conflict-categories',
    factText: 'amount, sender',
    actions: [{ action_id: 'CHECK_TRANSACTIONS', label: 'Check transactions', target: 'transactions' }],
  },
  {
    condition: 'COMPETING_CLAIMS',
    explanation: '2 active claims in this shop use the same payment transaction.',
    facts: {
      has_matching_receipt: true, active_claim_count: 2, claim_held_by_prior_resolution: false,
    },
    factTestId: 'review-fact-active-claim-count',
    factText: '2',
    actions: [{ action_id: 'CHECK_TRANSACTIONS', label: 'Check transactions', target: 'transactions' }],
  },
  {
    condition: 'PAYMENT_USED',
    explanation: 'The recorded payment is already used and allocated.',
    facts: { has_matching_receipt: true, payment_used: true, payment_allocated: true },
    factTestId: 'review-fact-payment-used',
    factText: 'Yes',
    actions: [{ action_id: 'CHECK_TRANSACTIONS', label: 'Check transactions', target: 'transactions' }],
  },
];

it.each(cases)('renders $condition explanation, facts, and allowed controls', async (item) => {
  const { container, root } = await renderAdvice(makeResponse({
    condition: item.condition,
    explanation: item.explanation,
    facts: item.facts,
    suggested_actions: item.actions,
    reason_codes: [item.condition],
  }));
  expect(container.querySelector('[data-testid="assistance-explanation"]')?.textContent)
    .toContain(item.explanation);
  expect(container.querySelector(`[data-testid="${item.factTestId}"]`)?.textContent)
    .toContain(item.factText);
  for (const action of item.actions) {
    expect(container.querySelector(`[data-testid="action-${action.action_id}"]`)).not.toBeNull();
  }
  expect(container.querySelectorAll('a')).toHaveLength(0);
  await act(async () => root.unmount());
});

it('renders combined reasons with all facts and only permitted actions', async () => {
  const { container, root } = await renderAdvice(makeResponse({
    condition: 'MULTIPLE_REVIEW_REASONS',
    explanation: 'This submission has several review reasons.',
    reason_codes: ['AMOUNT_MISMATCH', 'SENDER_MISMATCH', 'TIME_UNCLEAR'],
    facts: {
      has_matching_receipt: true,
      required_advance_minor: 200_000,
      claimed_amount_minor: 200_000,
      received_amount_minor: 150_000,
      currency: 'BDT',
      sender_status: 'different',
      time_status: 'missing',
    },
    suggested_actions: [
      { action_id: 'CHECK_TRANSACTIONS', label: 'Check transactions', target: 'transactions' },
      { action_id: 'CORRECT_BUYER_DETAILS', label: 'Correct buyer details', target: 'buyer_tab' },
    ],
  }));
  expect(container.querySelector('[data-testid="review-facts"]')).not.toBeNull();
  expect(container.querySelector('[data-testid="review-fact-received-amount"]')?.textContent)
    .toContain('৳1,500.00');
  expect(container.querySelector('[data-testid="review-fact-sender"]')?.textContent)
    .toContain('Different from the claimed sender');
  expect(container.querySelector('[data-testid="review-fact-payment-time"]')?.textContent)
    .toContain('No payment time recorded');
  expect(container.querySelector('[data-testid="action-CHECK_TRANSACTIONS"]')).not.toBeNull();
  expect(container.querySelector('[data-testid="action-CORRECT_BUYER_DETAILS"]')).not.toBeNull();
  await act(async () => root.unmount());
});

it('distinguishes a held claim from active competing claims', async () => {
  const active = await renderAdvice(makeResponse({
    condition: 'COMPETING_CLAIMS',
    explanation: '2 active claims in this shop use the same payment transaction.',
    reason_codes: ['COMPETING_CLAIMS'],
    facts: { has_matching_receipt: true, active_claim_count: 2, claim_held_by_prior_resolution: false },
    suggested_actions: [{ action_id: 'CHECK_TRANSACTIONS', label: 'Check transactions', target: 'transactions' }],
  }));
  expect(active.container.querySelector('[data-testid="review-fact-held-by-prior-resolution"]')?.textContent)
    .toContain('No');
  await act(async () => active.root.unmount());

  const held = await renderAdvice(makeResponse({
    condition: 'COMPETING_CLAIMS',
    explanation: 'This claim was held by an earlier review decision for this payment.',
    reason_codes: ['COMPETING_CLAIMS'],
    facts: { has_matching_receipt: true, active_claim_count: 0, claim_held_by_prior_resolution: true },
    suggested_actions: [{ action_id: 'CHECK_TRANSACTIONS', label: 'Check transactions', target: 'transactions' }],
  }));
  expect(held.container.querySelector('[data-testid="review-fact-held-by-prior-resolution"]')?.textContent)
    .toContain('Yes');
  expect(held.container.querySelector('[data-testid="review-fact-active-claim-count"]')?.textContent)
    .toContain('0');
  await act(async () => held.root.unmount());
});

it('never renders an unsupported action id', async () => {
  const unsupported = {
    action_id: 'APPROVE_PAYMENT', label: 'Approve payment', target: 'approve',
  } as unknown as SuggestedAction;
  const { container, root } = await renderAdvice(makeResponse({
    condition: 'NO_RECORDED_RECEIPT',
    suggested_actions: [
      { action_id: 'CHECK_TRANSACTIONS', label: 'Check transactions', target: 'transactions' },
      unsupported,
    ],
  }));
  expect(container.querySelector('[data-testid="action-CHECK_TRANSACTIONS"]')).not.toBeNull();
  expect(container.querySelector('[data-testid="action-APPROVE_PAYMENT"]')).toBeNull();
  expect(container.textContent).not.toContain('Approve payment');
  await act(async () => root.unmount());
});

it('switches fact copy on locale change without another request', async () => {
  const { container, root, fetchSpy } = await renderAdvice(makeResponse({
    condition: 'SENDER_MISMATCH',
    explanation: 'The sender number is missing.',
    reason_codes: ['SENDER_MISMATCH'],
    facts: { has_matching_receipt: true, sender_status: 'missing' },
    suggested_actions: [
      { action_id: 'CHECK_TRANSACTIONS', label: 'Check transactions', target: 'transactions' },
      { action_id: 'CORRECT_BUYER_DETAILS', label: 'Correct buyer details', target: 'buyer_tab' },
    ],
  }), true);
  expect(container.querySelector('[data-testid="review-fact-sender"]')?.textContent)
    .toContain('No sender number recorded');

  const bnButton = container.querySelector<HTMLButtonElement>('button[lang="bn"]')!;
  await act(async () => bnButton.click());
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[data-testid="assistance-explanation"]')?.textContent)
    .toContain('প্রেরকের নম্বর নেই');
  expect(container.querySelector('[data-testid="review-fact-sender"]')?.textContent)
    .toContain('কোনো প্রেরকের নম্বর রেকর্ড করা নেই');
  expect(container.querySelector('[data-testid="review-facts"]')?.textContent)
    .toContain('পর্যালোচনার বিবরণ');
  await act(async () => root.unmount());
});
