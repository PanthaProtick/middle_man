import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { PaymentHistory } from './PaymentHistory';
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
it('translates historical codes while preserving reasons, actors and amounts without refetch', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify([{
    transaction_id:'receipt', accepted_amount_minor:150000, actual_cod_minor:1050000,
    exceptions:['AMOUNT_MISMATCH','FUTURE_REASON'], reason:'manual SMS ১২', actor:'seller-১২', created_at:'2026-10-24T00:00:00Z',
  }]))).mockResolvedValueOnce(new Response(JSON.stringify({confirmed_count:3,manual_count:1,exception_count:1})));
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><PaymentHistory orderId="order" token="seller" /></LocaleProvider>));
  expect(host.textContent).toContain('Amount does not match');
  await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'বাংলা')!.click());
  expect(host.textContent).toContain('গৃহীত পেমেন্টের ইতিহাস');
  expect(host.textContent).toContain('টাকার পরিমাণ মেলেনি');
  expect(host.textContent).toContain('অজানা কারণ');
  expect(host.textContent).toContain('manual SMS ১২'); expect(host.textContent).toContain('seller-১২');
  expect(host.textContent).toContain('৳1,500.00'); expect(host.textContent).toContain('৳10,500.00');
  expect(host.textContent).toContain('অক্টোবর'); expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount()); host.remove();
});
