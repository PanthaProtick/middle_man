import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../../App';
import { Root as ApplicationRoot } from '../../Root';
import { awaitingOrder, findLanguageButton } from '../buyer/buyerLocaleFixtures';
import { LOCALE_STORAGE_KEY, LocaleProvider } from './index';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  document.title = '';
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  document.title = '';
  vi.restoreAllMocks();
});

const health = {
  status: 'healthy',
  project_name: 'Test',
  environment: 'test',
  database_configured: false,
  gemini_configured: false,
};

function mockEnvironment(options: { publicOrder?: Record<string, unknown> } = {}) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const target = String(url);
    if (target.includes('/api/public/orders/')) {
      return new Response(JSON.stringify(options.publicOrder ?? awaitingOrder));
    }
    if (target.includes('pathao-locations')) {
      return new Response(JSON.stringify({ condition: 'resolved', choices: [], simulated: true }));
    }
    return new Response(JSON.stringify(health));
  });
}

const read = (name: string) => container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)!;

async function edit(name: string, value: string) {
  const input = read(name);
  const prototype = input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
  await act(async () => input.dispatchEvent(new Event('input', { bubbles: true })));
}

async function renderApp() {
  await act(async () => root.render(<LocaleProvider><App /></LocaleProvider>));
}

function browserPrefers(language: string) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue([language]);
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(language);
}

it('starts in Bengali for a Bengali browser and persists an explicit English choice across a reload', async () => {
  browserPrefers('bn-BD');
  mockEnvironment();
  await renderApp();

  expect(container.textContent).toContain('আপনার দোকানে সাইন ইন করুন');
  expect(document.documentElement.lang).toBe('bn-BD');
  expect(document.title).toBe('বিক্রেতার কর্মক্ষেত্র · middleman');

  await act(async () => findLanguageButton(container, 'English').click());

  expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
  expect(document.documentElement.lang).toBe('en');
  expect(document.title).toBe('Seller workspace · middleman');

  await act(async () => root.unmount());
  root = createRoot(container);
  await renderApp();

  expect(container.textContent).toContain('Sign in to your shop');
  expect(document.title).toBe('Seller workspace · middleman');
});

it('starts in English when the browser does not prefer Bengali', async () => {
  browserPrefers('fr-FR');
  mockEnvironment();
  await renderApp();

  expect(container.textContent).toContain('Sign in to your shop');
  expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
  expect(document.documentElement.lang).toBe('en');
});

it('shares one device locale between the buyer portal and seller entry paths', async () => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'bn');
  window.history.replaceState({}, '', '/orders/shared-token');
  mockEnvironment();
  await renderApp();

  expect(container.textContent).toContain('অর্ডার নিশ্চিতকরণ');
  expect(container.textContent).toContain('ডেলিভারির আগে অগ্রিম');
  expect(document.title).toBe('অর্ডার নিশ্চিতকরণ · middleman');
  expect(container.querySelectorAll('.locale-switch')).toHaveLength(1);

  window.history.replaceState({}, '', '/');
  await renderApp();

  expect(container.textContent).toContain('আপনার দোকানে সাইন ইন করুন');
  expect(document.title).toBe('বিক্রেতার কর্মক্ষেত্র · middleman');
  expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('bn');
  expect(container.querySelectorAll('.locale-switch')).toHaveLength(1);
});

it('gives a shared buyer link the buyer device preference without reading a supplied locale or Clerk', async () => {
  browserPrefers('en-US');
  window.history.replaceState({}, '', '/orders/seller-authored-token');
  const fetchMock = mockEnvironment({
    publicOrder: { ...awaitingOrder, locale: 'bn', seller_locale: 'bn', language: 'bn' },
  });

  await act(async () => root.render(
    <LocaleProvider>
      <ApplicationRoot publishableKey="pk_test_seller_owned" publicPortal />
    </LocaleProvider>,
  ));

  expect(container.textContent).toContain('Delivery advance');
  expect(container.textContent).not.toContain('ডেলিভারির আগে অগ্রিম');
  expect(container.textContent).not.toContain('Sign in to your shop');
  expect(document.title).toBe('Order confirmation · middleman');
  expect(fetchMock.mock.calls.filter(([url]) => String(url) === '/api/public/orders/seller-authored-token')).toHaveLength(1);
});

it('switches a populated buyer form in place without losing values, remounting, or adding requests', async () => {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, 'bn');
  window.history.replaceState({}, '', '/orders/token');
  const fetchMock = mockEnvironment();
  await renderApp();

  await edit('buyer_name', 'রহিম ১২');
  await edit('contact_number', '০১৭১২৩৪৫৬৭৮');
  await edit('address_raw', 'বাড়ি ১২, Road 5');
  await edit('payment_sender', '০১৮১২৩৪৫৬৭৮');
  await edit('payment_trx_id', 'Tx১২ab');
  await edit('claimed_advance_bdt', '১২.০১');
  const nameInput = read('buyer_name');
  const requests = fetchMock.mock.calls.length;

  await act(async () => findLanguageButton(container, 'English').click());

  expect(read('buyer_name')).toBe(nameInput);
  expect(nameInput.value).toBe('রহিম ১২');
  expect(read('contact_number').value).toBe('০১৭১২৩৪৫৬৭৮');
  expect(read('address_raw').value).toBe('বাড়ি ১২, Road 5');
  expect(read('payment_trx_id').value).toBe('Tx১২ab');
  expect(read('claimed_advance_bdt').value).toBe('১২.০১');
  expect(fetchMock).toHaveBeenCalledTimes(requests);
  expect(document.title).toBe('Order confirmation · middleman');
  expect(document.documentElement.lang).toBe('en');
});
