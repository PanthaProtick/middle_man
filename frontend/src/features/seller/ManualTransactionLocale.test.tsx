import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { ManualTransactionModal } from './ManualTransactionModal';

it('retains opaque TrxID and Bengali amount through an in-dialog language switch and sends precise minor units once', async () => {
  localStorage.setItem('middleman.locale', 'bn');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({id:'receipt'})));
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const recorded = vi.fn();
  await act(async () => root.render(<LocaleProvider><ManualTransactionModal accounts={[{id:'account',shop_id:'shop',provider:'bkash',receiving_number:'01711223344',label:'নিজের ১২',is_active:true,version:1,created_at:'',updated_at:''}]} onClose={vi.fn()} onTransactionRecorded={recorded} /></LocaleProvider>));
  expect(host.textContent).toContain('প্রাপ্ত পেমেন্ট রেকর্ড করুন');
  const inputs = host.querySelectorAll('input');
  expect(inputs[0].getAttribute('placeholder')).toBe('যেমন: 9K72LKQW1');
  expect(inputs[1].getAttribute('placeholder')).toBe('যেমন: 150');
  expect(inputs[2].getAttribute('placeholder')).toBe('যেমন: 01700000000');
  await act(async () => {
    for (const [input,value] of [[inputs[0],'PAY১২'],[inputs[1],'১৫০.২৫']] as const) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }
  });
  await act(async () => Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='English')!.click());
  expect(inputs[0].getAttribute('placeholder')).toBe('e.g. 9K72LKQW1');
  expect(inputs[1].getAttribute('placeholder')).toBe('e.g. 150');
  expect(inputs[2].getAttribute('placeholder')).toBe('e.g. 01700000000');
  expect(inputs[0].value).toBe('PAY১২'); expect(inputs[1].value).toBe('১৫০.২৫');
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({trx_id:'PAY১২',amount_minor:15025});
  expect(recorded).toHaveBeenCalledTimes(1);
  await act(async()=>root.unmount()); host.remove(); localStorage.clear(); vi.restoreAllMocks();
});
