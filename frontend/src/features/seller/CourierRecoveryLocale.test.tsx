import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { CourierReview } from './CourierReview';
import { baseReview } from './courierPostSubmissionTestData';
import type { Review } from './courierReviewTypes';

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); document.body.innerHTML = ''; });
function inputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
async function mount(review: Review) {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><CourierReview orderId="order-1" token="seller" /></LocaleProvider>));
  return { host, root, review };
}
async function switchTo(host: HTMLElement, label: string) {
  await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === label)!.click());
}

it.each(['en', 'bn'])('keeps unknown-attempt edits and a failed reconciliation retry intact from %s', async locale => {
  localStorage.setItem('middleman.locale', locale);
  const review: Review = { ...baseReview, delivery_mismatch: null, latest_attempt: {
    ...baseReview.latest_attempt!, status: 'unknown', consignment_id: null, error_code: 'COURIER_TIMEOUT', error_message: 'Original timeout evidence ১২',
  } };
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method === 'POST') return new Response(JSON.stringify({ error: { code: 'EVIDENCE_UNAVAILABLE', message: 'Private provider evidence ১২' } }), { status: 422 });
    return new Response(JSON.stringify(String(url).includes('/locations?') ? { choices: [] } : review));
  });
  const { host, root } = await mount(review);
  const input = host.querySelector<HTMLInputElement>('[name="consignmentId"]')!;
  await act(async () => inputValue(input, 'CN-১২-A'));
  const checkbox = host.querySelector<HTMLInputElement>('[name="confirmedNoncreation"]')!;
  await act(async () => checkbox.click());
  input.focus(); const before = fetcher.mock.calls.length;
  await switchTo(host, locale === 'en' ? 'বাংলা' : 'English');
  expect(input.value).toBe('CN-১২-A'); expect(checkbox.checked).toBe(true); expect(document.activeElement).toBe(input);
  expect(fetcher).toHaveBeenCalledTimes(before);
  expect(host.querySelector('[data-submit]')).toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('[data-attach]')!.click());
  const first = fetcher.mock.calls.find(call => call[1]?.method === 'POST')![1]!;
  expect(JSON.parse(String(first.body))).toMatchObject({ consignment_id: 'CN-১২-A', expected_version: 0, environment: 'offline' });
  const count = fetcher.mock.calls.length;
  await switchTo(host, locale === 'en' ? 'English' : 'বাংলা');
  expect(fetcher).toHaveBeenCalledTimes(count);
  expect(host.textContent).toContain(locale === 'en' ? 'The consignment could not be verified' : 'কনসাইনমেন্ট যাচাই করা যায়নি');
  const original = Array.from(host.querySelectorAll('details')).find(detail => detail.textContent?.includes('Private provider evidence ১২'))!;
  expect(original.open).toBe(false);
  await act(async () => host.querySelector<HTMLButtonElement>('[data-attach]')!.click());
  const posts = fetcher.mock.calls.filter(call => call[1]?.method === 'POST');
  expect(posts).toHaveLength(2); expect(posts[1][1]).toEqual(first);
  expect(fetcher.mock.calls.some(call => String(call[0]).includes('/courier-submission'))).toBe(false);
  await act(async () => root.unmount());
});

it.each(['COURIER_REJECTED', 'UNRECOGNIZED_PROVIDER_CODE'])('localizes saved rejection %s and preserves original evidence', async code => {
  localStorage.setItem('middleman.locale', 'en');
  const review: Review = { ...baseReview, delivery_mismatch: null, latest_attempt: {
    ...baseReview.latest_attempt!, status: 'failed', consignment_id: null, error_code: code, error_message: 'Historical provider text ১২',
  } };
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => new Response(JSON.stringify(String(url).includes('/locations?') ? { choices: [] } : review)));
  const { host, root } = await mount(review); const count = fetcher.mock.calls.length;
  await switchTo(host, 'বাংলা');
  expect(host.querySelector('.booking-failed > p')?.textContent).toContain(code === 'COURIER_REJECTED' ? 'কুরিয়ার বুকিং প্রত্যাখ্যান করেছে' : 'কুরিয়ারের উত্তর বোঝা যায়নি');
  expect(host.querySelector('.booking-failed > p')?.textContent).not.toContain('Historical');
  expect(host.querySelector('.booking-failed details')?.textContent).toContain('Historical provider text ১২');
  expect(host.querySelector('.booking-failed details')?.hasAttribute('open')).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(count);
  await act(async () => root.unmount());
});

it('preserves selected provider IDs, names, focus and unsaved delivery choices across switching', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const review = { ...baseReview, latest_attempt: null, delivery_mismatch: null, reviewed: false };
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => {
    const path = String(url);
    const choices = path.includes('zone_id=2') ? [{ id: 3, name: 'Sector 3', home_delivery_available: false }]
      : path.includes('city_id=1') ? [{ id: 2, name: 'Uttara' }] : [{ id: 1, name: 'Dhaka' }];
    return new Response(JSON.stringify(path.includes('/locations?') ? { choices } : review));
  });
  const { host, root } = await mount(review);
  const service = Array.from(host.querySelectorAll('select')).find(select => select.closest('label')?.textContent?.includes('Delivery service'))!;
  await act(async () => { service.value = '12'; service.dispatchEvent(new Event('change', { bubbles: true })); });
  service.focus(); const count = fetcher.mock.calls.length;
  await switchTo(host, 'বাংলা');
  expect(service.value).toBe('12'); expect(document.activeElement).toBe(service);
  const locations = host.querySelectorAll('[aria-label="বিক্রেতার গন্তব্য নির্বাচন"] select');
  expect(Array.from(locations, item => (item as HTMLSelectElement).value)).toEqual(['1', '2', '3']);
  expect(host.textContent).toContain('Sector 3 — সেবা পাওয়া যায় না');
  expect(host.querySelector<HTMLButtonElement>('[data-review]')!.disabled).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(count);
  await act(async () => root.unmount());
});
