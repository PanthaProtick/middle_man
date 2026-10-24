import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { PaymentHistory } from './PaymentHistory';

afterEach(()=>vi.restoreAllMocks());
it('shows committed exceptions, reason and aggregate-only totals after refetch',async()=>{
  const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify([{
    transaction_id:'receipt',accepted_amount_minor:150000,actual_cod_minor:1050000,
    exceptions:['AMOUNT_MISMATCH','TIME_UNCLEAR'],reason:'Accepted app amount',actor:'seller',created_at:'2026-10-24T00:00:00Z',
  }]))).mockResolvedValueOnce(new Response(JSON.stringify({confirmed_count:3,manual_count:1,exception_count:1})));
  const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
  await act(async()=>root.render(<PaymentHistory orderId="order" token="seller"/>));
  expect(container.textContent).toContain('Accepted exceptions: AMOUNT_MISMATCH, TIME_UNCLEAR');
  expect(container.textContent).toContain('Reason: Accepted app amount');
  expect(container.textContent).toContain('Shop totals: 3 confirmed · 1 manual acceptances · 1 accepted exception orders');
  expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({Authorization:'Bearer seller'});
  await act(async()=>root.unmount());container.remove();
});
