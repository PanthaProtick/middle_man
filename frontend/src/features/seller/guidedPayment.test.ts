import { expect, it } from 'vitest';
import { emptyPaymentFields, hasMultiplePaymentFields, paymentMessage, paymentSummary, resolvePaymentAccount } from './guidedPayment';
import type { PaymentAccount } from './types';

const account = (overrides: Partial<PaymentAccount> = {}): PaymentAccount => ({
  id: 'account-1', shop_id: 'shop-1', provider: 'bkash', receiving_number: '01711223344',
  label: 'Main', is_active: true, version: 1, created_at: '', updated_at: '', ...overrides,
});
const accounts = [
  account(),
  account({ id: 'account-2', provider: 'nagad', receiving_number: '01811223344', label: 'Nagad' }),
];

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
