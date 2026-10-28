import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BuyerPortal } from './BuyerPortal';
import { awaitingOrder, findLanguageButton } from './buyerLocaleFixtures';
import { LOCALE_STORAGE_KEY, LocaleProvider, LocaleSwitch } from '../locale';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'bn');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

function edit(container: HTMLElement, name: string, value: string) {
  const input = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)!;
  const prototype = input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
async function render() {
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><BuyerPortal portalToken="token" /></LocaleProvider>));
}
async function submit() {
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

it('translates validation in place, retaining text, associated errors and first-invalid focus without requests', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => new Response(JSON.stringify(
    String(url).includes('pathao-locations') ? {condition: 'resolved', choices: [], simulated: true} : awaitingOrder,
  )));
  await render();
  expect(container.textContent).toContain('ডেলিভারি ও পেমেন্টের তথ্য');
  const contactPlaceholder = () => container.querySelector<HTMLInputElement>('[name="contact_number"]')!.placeholder;
  expect(contactPlaceholder()).toBe('যেমন: 017XXXXXXXX');
  expect(contactPlaceholder()).not.toMatch(/[০-৯]/);
  await act(async () => edit(container, 'address_raw', 'বাড়ি ১২, Road 5'));
  await submit();
  const name = container.querySelector<HTMLInputElement>('[name="buyer_name"]')!;
  expect(document.activeElement).toBe(name);
  expect(container.querySelector('#buyer_name-error')?.textContent).toBe('আপনার নাম লিখুন।');
  expect(name.getAttribute('aria-describedby')).toBe('buyer_name-error');
  const calls = fetchMock.mock.calls.length;
  await act(async () => findLanguageButton(container, 'English').click());
  expect(container.querySelector('#buyer_name-error')?.textContent).toBe('Enter your full name.');
  expect(contactPlaceholder()).toBe('017XXXXXXXX');
  expect(container.querySelector<HTMLTextAreaElement>('[name="address_raw"]')?.value).toBe('বাড়ি ১২, Road 5');
  expect(fetchMock).toHaveBeenCalledTimes(calls);
  expect(document.documentElement.lang).toBe('en');
  await act(async () => {
    edit(container, 'buyer_name', 'রহিম');
    edit(container, 'contact_number', '01712345678');
    edit(container, 'claimed_advance_bdt', '১.০০১');
  });
  await submit();
  expect(document.activeElement).toBe(container.querySelector('[name="claimed_advance_bdt"]'));
  expect(container.querySelector('[name="claimed_advance_bdt"]')?.getAttribute('aria-describedby')).toContain('claimed_advance_bdt-error');
});

async function fill() {
  for (const [field, value] of Object.entries({
    buyer_name: 'রহিম ১২', contact_number: '০১৭১২৩৪৫৬৭৮', address_raw: 'বাড়ি ১২, Road 5',
    payment_sender: '০১৮১২৩৪৫৬৭৮', payment_trx_id: 'Tx১২ab', claimed_advance_bdt: '১২.০১',
  })) await act(async () => edit(container, field, value));
}

it('accepts Bengali numeric input precisely and preserves opaque text across pending, unknown outcome and retry language changes', async () => {
  let rejectPost: (reason: Error) => void = () => undefined;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method === 'POST') return new Promise<Response>((_resolve, reject) => { rejectPost = reject; });
    return new Response(JSON.stringify(String(url).includes('pathao-locations')
      ? {condition: 'resolved', choices: [], simulated: true} : awaitingOrder));
  });
  await render();
  await fill();
  await submit();
  expect(container.querySelector('button[type="submit"]')?.textContent).toBe('জমা হচ্ছে…');
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  const calls = fetchMock.mock.calls.length;
  await act(async () => findLanguageButton(container, 'English').click());
  expect(container.querySelector('button[type="submit"]')?.textContent).toBe('Submitting…');
  expect(fetchMock).toHaveBeenCalledTimes(calls);
  await act(async () => rejectPost(new TypeError('Sensitive technical failure')));
  expect(container.textContent).toContain('Submission outcome unknown. Retry the same details below.');
  expect(container.textContent).not.toContain('Sensitive technical failure');
  const afterRecovery = fetchMock.mock.calls.length;
  await act(async () => findLanguageButton(container, 'বাংলা').click());
  expect(container.textContent).toContain('জমা হয়েছে কি না জানা যায়নি। একই তথ্য দিয়ে আবার চেষ্টা করুন।');
  expect(fetchMock).toHaveBeenCalledTimes(afterRecovery);
  await submit();
  const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
  expect(posts).toHaveLength(2);
  expect(posts[1][1]?.body).toBe(posts[0][1]?.body);
  expect(posts[1][1]?.headers).toEqual(posts[0][1]?.headers);
  expect(JSON.parse(String(posts[0][1]?.body))).toEqual({
    buyer_name: 'রহিম ১২', contact_number: '০১৭১২৩৪৫৬৭৮', address: {raw_text: 'বাড়ি ১২, Road 5'},
    payment_claim: {provider: 'bkash', trx_id: 'Tx১২ab', sender_number: '০১৮১২৩৪৫৬৭৮', amount_minor: 1201},
  });
  await act(async () => rejectPost(new TypeError('Retry response lost')));
});

it('localizes structured field errors and parameters, keeps focus and allows a corrected submission', async () => {
  let postCount = 0;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method === 'POST') {
      postCount++;
      return postCount === 1 ? new Response(JSON.stringify({error: {code: 'VALIDATION_ERROR', message: 'Raw technical detail',
        fields: [{field: 'payment_claim.trx_id', code: 'string_too_long', message: 'Raw value', params: {max_length: 128}}],
      }}), {status: 422}) : new Response(JSON.stringify({...awaitingOrder, lifecycle: 'pending', submission_acknowledgement: 'ACK-১২ab'}));
    }
    return new Response(JSON.stringify(String(url).includes('pathao-locations')
      ? {condition: 'resolved', choices: [], simulated: true} : awaitingOrder));
  });
  await render();
  await fill();
  await submit();
  const trx = container.querySelector<HTMLInputElement>('[name="payment_trx_id"]')!;
  expect(document.activeElement).toBe(trx);
  expect(container.querySelector('#payment_trx_id-error')?.textContent).toBe('সর্বোচ্চ 128 অক্ষর লিখুন।');
  expect(container.textContent).not.toContain('Raw');
  const calls = fetchMock.mock.calls.length;
  await act(async () => findLanguageButton(container, 'English').click());
  expect(container.querySelector('#payment_trx_id-error')?.textContent).toBe('Use at most 128 characters.');
  expect(document.activeElement).toBe(trx);
  expect(fetchMock).toHaveBeenCalledTimes(calls);
  await act(async () => edit(container, 'payment_trx_id', 'Corrected১২'));
  expect(container.querySelector('#payment_trx_id-error')).toBeNull();
  await submit();
  expect(container.textContent).toContain('Pending Seller Review');
  expect(container.textContent).toContain('ACK-১২ab');
  const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
  expect(posts).toHaveLength(2);
  expect(posts[1][1]?.headers).not.toEqual(posts[0][1]?.headers);
});

it.each([
  [410, 'EXPIRED_SUBMISSION', 'নতুন লিংকের জন্য বিক্রেতার সাথে যোগাযোগ করুন।', 'Order link has expired.'],
  [404, 'NOT_FOUND', 'অর্ডারের তথ্য পাওয়া যাচ্ছে না।', 'Order record unavailable.'],
  [429, 'PUBLIC_RATE_LIMITED', '10 সেকেন্ড পরে আবার চেষ্টা করুন।', 'Retry after 10 seconds.'],
  [413, 'PUBLIC_BODY_TOO_LARGE', 'তথ্যের আকার বেশি।', 'Request is too large.'],
  [400, 'UNFAMILIAR_ERROR', 'তথ্য জমা দেওয়া যায়নি।', 'Unable to submit.'],
] as const)('renders safe submission guidance for %s and retains the draft on switching', async (status, code, bengali, english) => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method === 'POST') return new Response(JSON.stringify({error: {code, message: 'Private server text'}}), {status, headers: {'Retry-After': '10'}});
    return new Response(JSON.stringify(String(url).includes('pathao-locations')
      ? {condition: 'resolved', choices: [], simulated: true} : awaitingOrder));
  });
  await render();
  await fill();
  await submit();
  expect(container.textContent).toContain(bengali);
  expect(container.textContent).not.toContain('Private server text');
  const calls = fetchMock.mock.calls.length;
  await act(async () => findLanguageButton(container, 'English').click());
  expect(container.textContent).toContain(english);
  expect(container.querySelector<HTMLInputElement>('[name="payment_trx_id"]')?.value).toBe('Tx১২ab');
  expect(fetchMock).toHaveBeenCalledTimes(calls);
  expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
});
