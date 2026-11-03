import { canonicalizeBdPhone } from './api';
import { conversationalAmount } from './guidedOrder';
import { asciiDigits } from './orderNumbers';
import type { ManualReceiptInput, PaymentAccount } from './types';
import { paymentMessageFields } from './paymentMessageFields';

export interface PaymentFields {
  account: string;
  trxId: string;
  amount: string;
  sender: string;
  occurredAt: string;
}

export type PaymentFieldKey = keyof PaymentFields;

export const emptyPaymentFields = (): PaymentFields => ({
  account: '', trxId: '', amount: '', sender: '', occurredAt: '',
});

const labels = /(?:^|[\s;,])(?<label>receiving account|account|hisab|হিসাব|অ্যাকাউন্ট|trx\s*id|transaction\s*id|txn\s*id|trx|transaction|ট্রানজেকশন(?:\s*আইডি)?|আইডি|amount received|received amount|actual received amount|amount|taka|টাকার পরিমাণ|টাকা|পরিমাণ|sender number|sender phone|sender|প্রেরকের নম্বর|প্রেরক|ফোন(?:\s*নম্বর)?|occurred at|payment time|occurred|time|তারিখ|সময়)\s*[:=]\s*/gi;

const keys: Record<string, PaymentFieldKey> = {
  account: 'account', 'receiving account': 'account', hisab: 'account', 'হিসাব': 'account', 'অ্যাকাউন্ট': 'account',
  'trx id': 'trxId', 'transaction id': 'trxId', 'txn id': 'trxId', trx: 'trxId', transaction: 'trxId',
  'ট্রানজেকশন': 'trxId', 'ট্রানজেকশন আইডি': 'trxId', 'আইডি': 'trxId',
  'amount received': 'amount', 'received amount': 'amount', 'actual received amount': 'amount', amount: 'amount',
  taka: 'amount', 'টাকার পরিমাণ': 'amount', 'টাকা': 'amount', 'পরিমাণ': 'amount',
  'sender number': 'sender', 'sender phone': 'sender', sender: 'sender', 'প্রেরকের নম্বর': 'sender',
  'প্রেরক': 'sender', 'ফোন': 'sender', 'ফোন নম্বর': 'sender',
  'occurred at': 'occurredAt', 'payment time': 'occurredAt', occurred: 'occurredAt', time: 'occurredAt',
  'তারিখ': 'occurredAt', 'সময়': 'occurredAt',
};

function normalizedAccountValue(value: string): string {
  const raw = asciiDigits(value).trim().toLowerCase();
  const digits = raw.replace(/[\s\-()]/g, '');
  try { return canonicalizeBdPhone(raw); } catch { return digits === raw ? raw : digits; }
}

function matchesAccount(account: PaymentAccount, value: string): boolean {
  const raw = value.trim().toLowerCase();
  if (!raw) return false;
  return account.id.toLowerCase() === raw || account.label.toLowerCase() === raw ||
    account.provider.toLowerCase() === raw ||
    normalizedAccountValue(account.receiving_number) === normalizedAccountValue(value);
}

/** Exactly one active account may be selected from text; ambiguity is never guessed. */
export function resolvePaymentAccount(value: string, accounts: PaymentAccount[]): string {
  const candidates = accounts.filter(account => account.is_active && matchesAccount(account, value));
  return candidates.length === 1 ? candidates[0].id : '';
}

export function hasMultiplePaymentFields(message: string): boolean {
  const matches = [...message.matchAll(labels)];
  const matched = matches.map(match => keys[match.groups!.label.toLowerCase()]);
  return new Set(matched).size !== matched.length || paymentMessageFields(unlabeledPaymentText(message, matches)).multiple;
}

function unlabeledPaymentText(message: string, matches: RegExpMatchArray[]): string {
  if (!matches.length) return message;
  let text = message.slice(0, matches[0].index);
  for (const [index, match] of matches.entries()) {
    const end = matches[index + 1]?.index ?? message.length;
    const value = message.slice(match.index! + match[0].length, end);
    const separator = value.indexOf(';');
    if (separator >= 0) text += ` ${value.slice(separator + 1)}`;
  }
  return text;
}

export function paymentMessage(message: string, accounts: PaymentAccount[]): Partial<PaymentFields> {
  const matches = [...message.matchAll(labels)];
  const patch: Partial<PaymentFields> = {};
  for (const [index, match] of matches.entries()) {
    const key = keys[match.groups!.label.toLowerCase()];
    if (!key) continue;
    const next = matches[index + 1];
    const raw = message.slice(match.index! + match[0].length, next?.index).trim();
    // The next label may consume its separator; otherwise remove only that separator.
    const value = key === 'trxId'
      ? (next && /^\s/.test(next[0]) ? raw.replace(/[;,]$/, '').trim() : raw)
      : raw.split(';')[0].replace(/[;,]+$/, '').trim();
    patch[key] = key === 'account' ? resolvePaymentAccount(value, accounts) : value;
  }
  // Do not interpret a labeled identifier or other field's value as an account.
  const natural = paymentMessageFields(unlabeledPaymentText(message, matches));
  if (!('account' in patch) && natural.provider) patch.account = resolvePaymentAccount(natural.provider, accounts);
  for (const key of ['amount', 'trxId', 'sender'] as const) {
    if (!(key in patch) && natural[key] !== undefined) patch[key] = natural[key];
  }
  return patch;
}

export interface PaymentSummary {
  errors: PaymentFieldKey[];
  payload: ManualReceiptInput | null;
}

const MAX_AMOUNT_MINOR = 100_000_000_000;

export function paymentSummary(fields: PaymentFields, accounts: PaymentAccount[]): PaymentSummary {
  const errors: PaymentFieldKey[] = [];
  const account = accounts.find(item => item.is_active && item.id === fields.account);
  if (!account) errors.push('account');
  const trxId = fields.trxId.trim();
  if (!trxId || trxId.length > 128) errors.push('trxId');
  const amount = conversationalAmount(fields.amount);
  if (amount === null || amount > MAX_AMOUNT_MINOR) errors.push('amount');
  const sender = fields.sender.trim();
  if (sender) {
    try { canonicalizeBdPhone(sender); } catch { errors.push('sender'); }
  }
  let occurredAt: string | null = null;
  if (fields.occurredAt.trim()) {
    const parsed = Date.parse(fields.occurredAt);
    if (Number.isNaN(parsed)) errors.push('occurredAt');
    else occurredAt = new Date(parsed).toISOString();
  }
  if (errors.length || !account || amount === null) return { errors, payload: null };
  return {
    errors,
    payload: {
      payment_account_id: account.id,
      provider: account.provider,
      trx_id: trxId,
      amount_minor: amount,
      sender_number: sender || null,
      occurred_at: occurredAt,
    },
  };
}
