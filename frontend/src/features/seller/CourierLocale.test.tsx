import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { CourierDraft } from './CourierDraft';
import { CourierReview } from './CourierReview';
import { baseReview } from './courierPostSubmissionTestData';

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); document.body.innerHTML = ''; });

it('switches parcel labels without replacing edits, focus, draft evidence or making another request', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    order_id: 'order-১২', status: 'local_proposal', version: 3,
    recipient_name: 'Buyer ১২', contact_number: '01711111111', address: 'Road ১২, Dhaka',
    remaining_cod_minor: 12345, parcel_weight_grams: 1500, parcel_quantity: 2,
    missing_parcel_fields: [], blockers: ['COURIER_CONNECTION_REQUIRED'],
  })));
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><CourierDraft orderId="order-১২" token="seller" /></LocaleProvider>));
  const weight = host.querySelector<HTMLInputElement>('#courier-weight')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(weight, '২.৫');
    weight.dispatchEvent(new Event('input', { bubbles: true }));
  });
  weight.focus();
  await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'বাংলা')!.click());
  expect(host.textContent).toContain('কুরিয়ার অনুরোধের খসড়া');
  expect(host.textContent).toContain('পার্সেলের ওজন (কেজি)');
  expect(weight.value).toBe('২.৫'); expect(document.activeElement).toBe(weight);
  expect(host.textContent).toContain('Buyer ১২'); expect(host.textContent).toContain('Road ১২, Dhaka');
  expect(host.textContent).toContain('123.45'); expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});

it('switches an in-flight submission and its accepted result without repeating the booking', async () => {
  localStorage.setItem('middleman.locale', 'en');
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>(resolve => { finish = resolve; });
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
    if (String(url).includes('/courier-submission')) return pending;
    return new Response(JSON.stringify(String(url).includes('/locations?') ? { choices: [] }
      : { ...baseReview, latest_attempt: null, delivery_mismatch: null, submission_enabled: true }));
  });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><CourierReview orderId="order-1" token="seller" /></LocaleProvider>));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-submit]')!.click());
  const count = fetcher.mock.calls.length;
  await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'বাংলা')!.click());
  expect(host.textContent).toContain('বুকিং জমা হচ্ছে:');
  expect(host.querySelector<HTMLButtonElement>('[data-submit]')!.disabled).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(count);
  await act(async () => finish(new Response(JSON.stringify(baseReview))));
  expect(host.textContent).toContain('বুকিং নিশ্চিত হয়েছে (অফলাইন অনুকরণ)।');
  expect(host.textContent).toContain('SIM-PATHAO-12345');
  expect(host.textContent).toContain('Original Address 123');
  expect(host.textContent).toContain('Pathao বুকিং বদলায় না');
  expect(fetcher.mock.calls.filter(call => String(call[0]).includes('/courier-submission'))).toHaveLength(1);
  await act(async () => root.unmount());
});
