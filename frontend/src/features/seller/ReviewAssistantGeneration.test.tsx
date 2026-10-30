import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { ReviewAssistant } from './ReviewAssistant';
import { baseOrder } from './reviewAssistanceTestSupport';

const local = {
  order_id: baseOrder.id, order_version: 1, buyer_revision: 1, lifecycle: 'pending',
  context_token: 'current', source: 'local', condition: 'NO_RECORDED_RECEIPT',
  explanation: 'Local explanation', reason_codes: [], facts: { has_matching_receipt: false },
  suggested_actions: [{ action_id: 'CHECK_TRANSACTIONS', target: 'https://evil.invalid', label: 'Inspect' }],
  locale: 'en',
};
const response = (data: object) => new Response(JSON.stringify(data));
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); document.body.innerHTML = ''; });

async function mount() {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<LocaleProvider><LocaleSwitch />
    <ReviewAssistant order={baseOrder} token="seller" /></LocaleProvider>));
  const click = async (selector: string) => {
    await act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());
  };
  return { root, container, click };
}

it('generates only explicitly, prevents duplicates, reuses current view, and switches locale locally', async () => {
  let finish!: (value: Response) => void;
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(local))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockImplementation(async () => response(local));
  const view = await mount();
  expect(fetch).not.toHaveBeenCalled();
  await view.click('[data-testid="ask-ai-button"]');
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).not.toHaveProperty('generate');
  await view.click('[data-testid="generate-review"]');
  await view.click('[data-testid="generate-review"]');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({ language: 'en', generate: true });
  await act(async () => finish(response({ ...local, source: 'generated', explanation: 'Gemini wording' })));
  expect(view.container.textContent).toContain('Gemini explanation');
  expect(view.container.textContent).toContain('Gemini wording');
  expect(view.container.querySelector('a')).toBeNull();
  await view.click('[data-testid="ask-ai-button"]');
  await view.click('[data-testid="ask-ai-button"]');
  expect(view.container.textContent).toContain('Gemini wording');
  expect(JSON.parse(String(fetch.mock.calls[2][1]?.body))).not.toHaveProperty('generate');
  await view.click('button[lang="bn"]');
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(view.container.textContent).not.toContain('Gemini wording');
  expect(view.container.textContent).toContain('স্থানীয় নির্দেশনা');
  await act(async () => view.root.unmount());
});

it.each(['disabled', 'unconfigured', 'busy', 'limited', 'timeout', 'rejected', 'malformed', 'unavailable'])(
  'shows useful local fallback for %s', async fallback_status => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ ...local, fallback_status }));
    const view = await mount();
    await view.click('[data-testid="ask-ai-button"]');
    expect(view.container.querySelector('[role="status"]')?.textContent).toBeTruthy();
    expect(view.container.textContent).toContain('Local explanation');
    expect(view.container.querySelector('[data-testid="action-CHECK_TRANSACTIONS"]')).not.toBeNull();
    await act(async () => view.root.unmount());
  },
);

it('discards a late generation after sign-out', async () => {
  let finish!: (value: Response) => void;
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(local))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = await mount();
  await view.click('[data-testid="ask-ai-button"]');
  await view.click('[data-testid="generate-review"]');
  await act(async () => view.root.render(<LocaleProvider>
    <ReviewAssistant order={baseOrder} token="" /></LocaleProvider>));
  await act(async () => finish(response({ ...local, source: 'generated', explanation: 'Late private advice' })));
  expect(view.container.textContent).not.toContain('Late private advice');
  expect(view.container.querySelector('[data-testid="review-assistant-root"]')).toBeNull();
  await act(async () => view.root.unmount());
});

it('discards a generation completed after a locale change', async () => {
  let finish!: (value: Response) => void;
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(local))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = await mount();
  await view.click('[data-testid="ask-ai-button"]');
  await view.click('[data-testid="generate-review"]');
  await view.click('button[lang="bn"]');
  await act(async () => finish(response({ ...local, source: 'generated', explanation: 'Late English advice' })));
  expect(view.container.textContent).not.toContain('Late English advice');
  expect(view.container.textContent).toContain('স্থানীয় নির্দেশনা');
  await act(async () => view.root.unmount());
});
