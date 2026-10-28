import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { CreateOrderModal } from './CreateOrderModal';
import type { PaymentAccount } from './types';

const account: PaymentAccount = { id: 'account', shop_id: 'shop', provider: 'bkash',
  receiving_number: '01711223344', label: 'নিজের Account ১২', is_active: true,
  version: 1, created_at: '', updated_at: '' };
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); document.body.innerHTML = ''; });

it('retains Bengali numeric drafts and sends precise original terms once while switching during creation', async () => {
  localStorage.setItem('middleman.locale', 'bn');
  let finish!: (response: Response) => void;
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const created = vi.fn();
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><CreateOrderModal accounts={[account]}
    onClose={vi.fn()} onOrderCreated={created} onError={vi.fn()} /></LocaleProvider>));
  expect(host.textContent).toContain('অর্ডার ও ক্রেতার লিংক তৈরি করুন');
  const enter = (name: string, value: string) => {
    const input = host.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  await act(async () => {
    enter('productName', 'Bag ১২'); enter('totalBdt', '২৫০০.২৫'); enter('advanceBdt', '৩০০.১০');
    enter('parcelWeightKg', '১.০০১'); enter('parcelQuantity', '২');
  });
  expect(host.textContent).toContain('2,200.15');
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ product_name: 'Bag ১২',
    total_minor: 250025, required_advance_minor: 30010, payment_account_id: 'account',
    parcel_weight_grams: 1001, parcel_quantity: 2 });
  await act(async () => Array.from(host.querySelector('[role="dialog"]')!.querySelectorAll('button')).find(button => button.textContent === 'English')!.click());
  expect(host.textContent).toContain('Creating Link...');
  expect(host.querySelector<HTMLInputElement>('[name="totalBdt"]')!.value).toBe('২৫০০.২৫');
  expect(host.textContent).toContain(account.label);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => finish(new Response(JSON.stringify({ id: 'created' }), { status: 201 })));
  expect(created).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});
it('translates server field errors, retains failed values and retries with the same key after switching', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: {
    code: 'VALIDATION_ERROR', message: 'Internal English detail', fields: [
      { field: 'payment_account_id', code: 'value_error', message: 'raw server account detail' },
      { field: 'parcel_weight_grams', code: 'less_than_equal', message: 'raw server detail' },
    ],
  } }), { status: 422 }));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><CreateOrderModal accounts={[account]}
    onClose={vi.fn()} onOrderCreated={vi.fn()} onError={vi.fn()} /></LocaleProvider>));
  for (const [name, value] of Object.entries({ productName: 'Bag ১২', totalBdt: '10.25', advanceBdt: '1.05', parcelWeightKg: '1' })) {
    await act(async () => {
      const input = host.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  const weight = host.querySelector<HTMLInputElement>('[name="parcelWeightKg"]')!;
  expect(weight.getAttribute('aria-invalid')).toBe('true');
  expect(document.activeElement).toBe(weight);
  expect(host.textContent).not.toContain('raw server detail');
  await act(async () => Array.from(host.querySelector('[role="dialog"]')!.querySelectorAll('button')).find(button => button.textContent === 'বাংলা')!.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('পার্সেলের ওজন');
  expect(weight.value).toBe('1');
  expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockResolvedValue(new Response(JSON.stringify({ id: 'created' }), { status: 201 }));
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(fetcher.mock.calls[1][1]).toEqual(fetcher.mock.calls[0][1]);
  await act(async () => root.unmount());
});
it.each(['en', 'bn'] as const)('announces numeric and parcel validation in %s and preserves focus when translating an error', async locale => {
  localStorage.setItem('middleman.locale', locale);
  const fetcher = vi.spyOn(globalThis, 'fetch');
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><CreateOrderModal accounts={[account]}
    onClose={vi.fn()} onOrderCreated={vi.fn()} onError={vi.fn()} /></LocaleProvider>));
  const enter = async (name: string, value: string) => act(async () => {
    const input = host.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const submit = async () => act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await enter('productName', 'অপরিবর্তিত ১২'); await enter('advanceBdt', '1');
  for (const invalid of ['1e2', '1.001', '90071992547409.92', '0', '-1']) {
    await enter('totalBdt', invalid); await submit();
    const field = host.querySelector<HTMLInputElement>('[name="totalBdt"]')!;
    expect(document.activeElement).toBe(field); expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe('create-order-error');
  }
  await enter('totalBdt', '90071992547409.91');
  expect(host.textContent).toContain('90,071,992,547,408.91');
  await enter('totalBdt', '১০.২৫'); await enter('parcelWeightKg', '১.০০০১'); await enter('parcelQuantity', '২.৫'); await submit();
  const weight = host.querySelector<HTMLInputElement>('[name="parcelWeightKg"]')!;
  expect(document.activeElement).toBe(weight);
  expect(host.querySelector('#parcel-weight-error')?.textContent).toContain(locale === 'bn' ? '3 ঘর' : '3 decimal');
  const switchButton = Array.from(host.querySelectorAll('button')).find(button => button.textContent === (locale === 'en' ? 'বাংলা' : 'English'))!;
  switchButton.focus(); await act(async () => switchButton.click());
  expect(document.activeElement).toBe(switchButton);
  expect(host.querySelector('#parcel-weight-error')?.textContent).toContain(locale === 'en' ? '3 ঘর' : '3 decimal');
  expect(weight.value).toBe('১.০০০১'); expect(fetcher).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});
