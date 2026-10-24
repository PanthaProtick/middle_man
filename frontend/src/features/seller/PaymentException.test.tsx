import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { PaymentException } from './PaymentException';

afterEach(() => vi.restoreAllMocks());

it('shows actual COD and retries an unknown approval with the identical payload and key', async () => {
  const receipt = {id:'receipt', provider:'bkash',trx_id:'PAY',amount_minor:150000,payment_account_id:'account',version:1};
  const preview = {receipt,order_id:'order',expected_version:2,expected_transaction_version:1,
    claim_provider:'bkash',claim_trx_id:'PAY',claim_sender:'01822222222',claim_amount_minor:200000,
    claim_submitted_at:'2026-10-24T01:00:00Z',order_created_at:'2026-10-24T00:00:00Z',
    account_provider:'bkash',payment_account_id:'account',total_minor:1200000,required_advance_minor:200000,
    accepted_amount_minor:150000,actual_cod_minor:1050000,exceptions:['AMOUNT_MISMATCH','TIME_UNCLEAR'],blockers:[]};
  const response = (data:unknown) => new Response(JSON.stringify(data));
  const writes:RequestInit[] = [];
  const done = vi.fn();
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(response({items:[receipt],next_cursor:null}))
    .mockResolvedValueOnce(response(preview))
    .mockImplementationOnce(async (_url,init) => {writes.push(init!); throw new Error('Connection lost');})
    .mockImplementationOnce(async (_url,init) => {writes.push(init!);return response({id:'order',lifecycle:'confirmed'});});
  const container = document.createElement('div');document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<PaymentException orderId="order" token="seller" onAccepted={done} />));
  await act(async () => {const select = container.querySelector('select')!; select.value='receipt';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(container.textContent).toContain('Remaining COD after acceptance: BDT 10,500.00');
  expect(container.textContent).toContain('AMOUNT_MISMATCH');
  await act(async () => {const field=container.querySelector('textarea')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(field,'Accept actual receipt');
    field.dispatchEvent(new Event('input',{bubbles:true}));});
  const submit = () => act(async () => {container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  await submit();
  expect(container.textContent).toContain('Retry same approval');
  expect(container.querySelector('textarea')!.disabled).toBe(true);
  await submit();
  expect(writes[0]?.body).toBe(writes[1]?.body);
  expect(writes[0]?.headers).toEqual(writes[1]?.headers);
  expect(JSON.parse(String(writes[0]?.body))).toMatchObject({accepted_amount_minor:150000,expected_transaction_version:1,reason:'Accept actual receipt'});
  expect(done).toHaveBeenCalledWith({id:'order',lifecycle:'confirmed'});
  await act(async () => root.unmount());container.remove();
});

it.each([
  {blockers:['PAYMENT_EXCEEDS_TOTAL'],message:'Cannot accept: PAYMENT_EXCEEDS_TOTAL',status:200},
  {blockers:[],message:'Seller sign-in required',status:401},
])('blocks unsafe or unauthorized previews: $message', async ({blockers,message,status}) => {
  const receipt={id:'receipt',provider:'bkash',trx_id:'PAY',amount_minor:1200001,payment_account_id:'account',version:1};
  const preview={receipt,order_id:'order',expected_version:2,expected_transaction_version:1,
    claim_provider:'bkash',claim_trx_id:'PAY',claim_sender:'01822222222',claim_amount_minor:200000,
    claim_submitted_at:'2026-10-24T01:00:00Z',order_created_at:'2026-10-24T00:00:00Z',
    account_provider:'bkash',payment_account_id:'account',total_minor:1200000,required_advance_minor:200000,
    accepted_amount_minor:1200001,actual_cod_minor:null,exceptions:['AMOUNT_MISMATCH'],blockers};
  const spy=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({items:[receipt]})))
    .mockResolvedValueOnce(new Response(JSON.stringify(status===200 ? preview : {error:{code:'UNAUTHORIZED',message}}),{status}));
  const container=document.createElement('div');document.body.append(container);const root=createRoot(container);
  await act(async()=>root.render(<PaymentException orderId="order" token="seller" onAccepted={vi.fn()} />));
  await act(async()=>{const select=container.querySelector('select')!;select.value='receipt';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(container.textContent).toContain(message);
  if(status===200) expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  else expect(container.querySelector('form')).toBeNull();
  expect(spy.mock.calls).toHaveLength(2);
  await act(async()=>root.unmount());container.remove();
});
