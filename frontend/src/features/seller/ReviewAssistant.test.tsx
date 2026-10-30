import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { ReviewAssistant } from './ReviewAssistant';
import { baseOrder } from './reviewAssistanceTestSupport';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.innerHTML = '';
});



it('does not render for non-pending orders', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <ReviewAssistant
        order={{ ...baseOrder, lifecycle: 'awaiting_buyer' }}
      />
    );
  });

  expect(container.querySelector('[data-testid="ask-ai-button"]')).toBeNull();
  await act(async () => root.unmount());
});

it('fetches and renders local guidance, actions, and reuses cache on reopen', async () => {
  const responseData = {
    order_id: 'order-1',
    order_version: 1,
    buyer_revision: 1,
    lifecycle: 'pending',
    source: 'local',
    context_token: 'context-1',
    condition: 'NO_RECORDED_RECEIPT',
    reason_codes: [],
    explanation: 'No matching seller transaction record was found for this payment claim.',
    suggested_actions: [
      { action_id: 'CHECK_TRANSACTIONS', label: 'Check transactions', target: 'transactions' },
      { action_id: 'CORRECT_BUYER_DETAILS', label: 'Correct buyer details', target: 'buyer_tab' },
    ],
    facts: { has_matching_receipt: false },
    locale: 'en',
  };

  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(responseData), { status: 200 }));

  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const actionMock = vi.fn();

  await act(async () => {
    root.render(
      <LocaleProvider>
        <ReviewAssistant order={baseOrder} token="test-token" onAction={actionMock} />
      </LocaleProvider>
    );
  });

  const button = container.querySelector<HTMLButtonElement>('[data-testid="ask-ai-button"]')!;
  expect(button).not.toBeNull();
  expect(button.textContent).toContain('Ask AI');

  // Open guidance
  await act(async () => {
    button.click();
  });

  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[data-testid="local-guidance-badge"]')?.textContent).toContain('Local guidance');
  expect(container.querySelector('[data-testid="assistance-explanation"]')?.textContent).toContain(
    'No matching seller transaction record was found'
  );

  // Click action revalidates before navigation
  const actionBtn = container.querySelector<HTMLButtonElement>('[data-testid="action-CHECK_TRANSACTIONS"]')!;
  expect(actionBtn).not.toBeNull();
  await act(async () => {
    actionBtn.click();
  });
  expect(actionMock).toHaveBeenCalledWith('CHECK_TRANSACTIONS');

  // An approved action closes guidance before navigating.
  expect(container.querySelector('[data-testid="review-assistant-panel"]')).toBeNull();

  // Reopen revalidates the local context before reusing advice
  await act(async () => {
    button.click();
  });
  expect(fetchSpy).toHaveBeenCalledTimes(3);
  expect(container.querySelector('[data-testid="assistance-explanation"]')?.textContent).toContain(
    'No matching seller transaction record was found'
  );

  await act(async () => root.unmount());
});

it('updates guidance text on locale switch without refetching', async () => {
  const responseData = {
    order_id: 'order-1',
    order_version: 1,
    buyer_revision: 1,
    lifecycle: 'pending',
    source: 'local',
    context_token: 'context-1',
    condition: 'NO_RECORDED_RECEIPT',
    reason_codes: [],
    explanation: 'No matching seller transaction record was found for this payment claim.',
    suggested_actions: [
      { action_id: 'CHECK_TRANSACTIONS', label: 'Check transactions', target: 'transactions' },
    ],
    facts: { has_matching_receipt: false },
    locale: 'en',
  };

  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(responseData), { status: 200 }));

  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <LocaleProvider>
        <LocaleSwitch />
        <ReviewAssistant order={baseOrder} token="test-token" />
      </LocaleProvider>
    );
  });

  // Open guidance in English
  const button = container.querySelector<HTMLButtonElement>('[data-testid="ask-ai-button"]')!;
  await act(async () => {
    button.click();
  });
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[data-testid="assistance-explanation"]')?.textContent).toContain(
    'No matching seller transaction record was found'
  );

  // Switch to Bengali
  const bnButton = container.querySelector<HTMLButtonElement>('button[lang="bn"]')!;
  await act(async () => {
    bnButton.click();
  });

  // Refetch was NOT called
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  // Bengali explanation displayed
  expect(container.querySelector('[data-testid="assistance-explanation"]')?.textContent).toContain(
    'কোনো বিক্রেতা লেনদেন রেকর্ড পাওয়া যায়নি'
  );
  expect(container.querySelector('[data-testid="local-guidance-badge"]')?.textContent).toContain('স্থানীয় নির্দেশনা');

  await act(async () => root.unmount());
});

it('invalidates cache and closes when order version changes', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({
    order_id: baseOrder.id, order_version: 1, buyer_revision: 1, lifecycle: 'pending',
    context_token: 'original', condition: 'NO_RECORDED_RECEIPT', suggested_actions: [],
  }), { status: 200 }));
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <LocaleProvider>
        <ReviewAssistant order={baseOrder} token="seller" />
      </LocaleProvider>
    );
  });

  await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="ask-ai-button"]')!.click());
  expect(container.querySelector('[data-testid="assistance-explanation"]')).not.toBeNull();
  // Re-render with version change
  await act(async () => {
    root.render(
      <LocaleProvider>
        <ReviewAssistant order={{ ...baseOrder, version: 2 }} token="seller" />
      </LocaleProvider>
    );
  });

  expect(container.querySelector('[data-testid="review-assistant-panel"]')).toBeNull();
  await act(async () => root.unmount());
});
