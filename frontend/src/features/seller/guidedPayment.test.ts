import { expect, it } from 'vitest';
import { emptyPaymentFields, hasMultiplePaymentFields, paymentMessage, paymentSummary, resolvePaymentAccount } from './guidedPayment';
import type { PaymentAccount } from './types';
import { interpretWorkflow } from './assistantConversation';

const account = (overrides: Partial<PaymentAccount> = {}): PaymentAccount => ({
  id: 'account-1', shop_id: 'shop-1', provider: 'bkash', receiving_number: '01711223344',
  label: 'Main', is_active: true, version: 1, created_at: '', updated_at: '', ...overrides,
});
const accounts = [
  account(),
  account({ id: 'account-2', provider: 'nagad', receiving_number: '01811223344', label: 'Nagad' }),
];

it.each([
  'Bkash received 500 tk TrxID 9K23M4 from 01711000000',
  'বিকাশে ৫০০ টাকা পেয়েছি আইডি 9K23M4 প্রেরক 01711000000',
  'bkash e 500 taka peyechi TrxID 9K23M4 from 01711000000',
])('opens and prefills a received payment from %s', message => {
  expect(interpretWorkflow(message)).toEqual(['payment']);
  const fields = paymentMessage(message, accounts);
  expect(paymentSummary({ ...emptyPaymentFields(), ...fields }, accounts).payload).toMatchObject({
    payment_account_id: 'account-1', provider: 'bkash', trx_id: '9K23M4',
    sender_number: '01711000000', amount_minor: 50000,
  });
});

it('interprets bilingual payment fields and derives the provider from the selected account', () => {
  const english = paymentMessage(
    'Record payment; account: Main; trx id: 9K72LKQW1; amount: ৳১,২৫০.৫০; sender number: 01811223344',
    accounts,
  );
  expect(english).toEqual({
    account: 'account-1', trxId: '9K72LKQW1', amount: '৳১,২৫০.৫০', sender: '01811223344',
  });
  const bangla = paymentMessage('পেমেন্ট রেকর্ড; অ্যাকাউন্ট: Nagad; ট্রানজেকশন আইডি: ABC123; টাকা: ৫০০', accounts);
  expect(bangla).toEqual({ account: 'account-2', trxId: 'ABC123', amount: '৫০০' });
});

it('requires exactly one active account and never guesses between matching accounts', () => {
  expect(resolvePaymentAccount('bkash', [accounts[0], account({ id: 'account-3', label: 'Second bKash' })])).toBe('');
  expect(resolvePaymentAccount('bkash', [accounts[0]])).toBe('account-1');
  expect(resolvePaymentAccount('01711223344', accounts)).toBe('account-1');
  expect(resolvePaymentAccount('01811223344', accounts)).toBe('account-2');
  expect(resolvePaymentAccount('missing', accounts)).toBe('');
  expect(resolvePaymentAccount('Main', [account({ is_active: false })])).toBe('');
});

it('leaves ambiguous accounts unresolved and preserves invalid amounts for correction', () => {
  const message = 'Bkash received -500 tk TrxID Exact-9 from 01711000000';
  const fields = paymentMessage(message, [accounts[0], account({ id: 'other' })]);
  expect(fields).toMatchObject({ account: '', amount: '-500', trxId: 'Exact-9' });
  expect(paymentSummary({ ...emptyPaymentFields(), ...fields }, accounts).errors).toEqual(['account', 'amount']);
  expect(paymentMessage('Record payment; trx id: bkash; amount: 500', accounts)).not.toHaveProperty('account');
});

it('asks for clarification for several natural payment records instead of selecting the first', () => {
  expect(hasMultiplePaymentFields('Bkash received 500 tk TrxID FIRST from 01711000000; nagad received 600 tk TrxID SECOND from 01811000000')).toBe(true);
});

it('prefills natural details following a labeled receiving account', () => {
  expect(paymentMessage('Record payment; account: Main; received 500 tk TrxID 9K23M4 from 01711000000', accounts))
    .toMatchObject({ account: 'account-1', amount: '500', trxId: '9K23M4', sender: '01711000000' });
});

it('preserves the exact transaction identifier and keeps optional fields optional', () => {
  const summary = paymentSummary({
    account: 'account-1', trxId: '  ExAct-Trx 01  ', amount: '150.00', sender: '', occurredAt: '',
  }, accounts);
  expect(summary.errors).toEqual([]);
  expect(summary.payload).toMatchObject({
    payment_account_id: 'account-1', provider: 'bkash', trx_id: 'ExAct-Trx 01', amount_minor: 15000,
    sender_number: null, occurred_at: null,
  });
});

it('reports every missing or invalid field together without dropping valid input', () => {
  const summary = paymentSummary({
    account: '', trxId: '   ', amount: '0', sender: '123', occurredAt: 'not-a-date',
  }, accounts);
  expect(summary.errors).toEqual(['account', 'trxId', 'amount', 'sender', 'occurredAt']);
  expect(summary.payload).toBeNull();
  expect(paymentSummary({ account: 'account-1', trxId: 'A', amount: '1,2', sender: '', occurredAt: '' }, accounts).errors)
    .toEqual(['amount']);
  expect(paymentSummary({ account: 'account-1', trxId: 'A', amount: '1', sender: '01700000000', occurredAt: '2026-11-01T10:00' }, accounts).errors)
    .toEqual([]);
});

it('flags repeated field labels so an ambiguous message is clarified instead of overwritten', () => {
  expect(hasMultiplePaymentFields('account: Main; account: Nagad')).toBe(true);
  expect(hasMultiplePaymentFields('account: Main; trx id: A; amount: 5')).toBe(false);
});

it.each(['AbC;', 'AbC,', 'ExAct  ID;,'])('preserves terminal identifier punctuation: %s', trxId => {
  expect(paymentMessage(`trx id:  ${trxId}  `, accounts)).toEqual({ trxId });
  expect(paymentMessage(`trx id: ${trxId}; amount: 100`, accounts)).toEqual({ trxId, amount: '100' });
  expect(paymentMessage(`trx id: ${trxId};amount: 100`, accounts)).toEqual({ trxId, amount: '100' });
});

it('keeps a Bengali conversational identifier intact through payload construction', () => {
  const patch = paymentMessage('অ্যাকাউন্ট: Main; টাকা: ১০০; আইডি: ExAct  ID;,', accounts);
  expect(paymentSummary({ ...emptyPaymentFields(), ...patch }, accounts).payload)
    .toMatchObject({ trx_id: 'ExAct  ID;,', amount_minor: 10000 });
});
