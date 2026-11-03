import { asciiDigits, orderAmountMinor } from './orderNumbers';
import { parseParcelQuantity, parseParcelWeightKg } from './parcel';
import type { OrderInput, PaymentAccount } from './types';
import { orderMessageCandidates } from './orderMessageCandidates';

export interface OrderFields { total: string; advance: string; account: string; weight: string; quantity: string }
export const emptyOrderFields = (): OrderFields => ({ total: '', advance: '', account: '', weight: '', quantity: '' });

export function conversationalAmount(value: string): number | null {
  let raw = asciiDigits(value).trim().replace(/^(?:BDT|Tk\.?|৳|টাকা)\s*/i, '')
    .replace(/\s*(?:BDT|Tk\.?|৳|টাকা|taka)$/i, '').trim();
  if (raw.includes(',')) {
    if (!/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(raw) &&
      !/^\d{1,2}(?:,\d{2})*,\d{3}(?:\.\d{1,2})?$/.test(raw)) return null;
    raw = raw.replaceAll(',', '');
  }
  return orderAmountMinor(raw);
}

const labels = /(?:^|[\s;,])(?<label>product(?: name)?|পণ্য(?:ের নাম)?|ponno|total|মোট(?: মূল্য| দাম)?|mot|advance|অগ্রিম|ogrim|account|অ্যাকাউন্ট|হিসাব|weight|ওজন|quantity|পরিমাণ)\s*[:=]\s*/gi;
const keys: Record<string, keyof OrderFields | 'value'> = {
  product: 'value', 'product name': 'value', 'পণ্য': 'value', 'পণ্যের নাম': 'value', ponno: 'value',
  total: 'total', 'মোট': 'total', 'মোট মূল্য': 'total', 'মোট দাম': 'total', mot: 'total',
  advance: 'advance', 'অগ্রিম': 'advance', ogrim: 'advance', account: 'account', 'অ্যাকাউন্ট': 'account',
  'হিসাব': 'account', weight: 'weight', 'ওজন': 'weight', quantity: 'quantity', 'পরিমাণ': 'quantity',
};
export function hasMultipleOrderFields(message: string): boolean {
  const fields = [...message.matchAll(labels)].map(match => keys[match.groups!.label.toLowerCase()]);
  return new Set(fields).size !== fields.length;
}
export function orderMessage(message: string, accounts: PaymentAccount[]): Partial<OrderFields & { value: string }> {
  const matches = [...message.matchAll(labels)];
  const patch: Partial<OrderFields & { value: string }> = orderMessageCandidates(message);
  for (const [index, match] of matches.entries()) {
    const key = keys[match.groups!.label.toLowerCase()];
    const value = message.slice(match.index! + match[0].length, matches[index + 1]?.index).trim().replace(/[;,]+$/, '').trim();
    if (key === 'account') {
      const candidates = accounts.filter(account => account.is_active &&
        [account.id, account.label, account.provider, account.receiving_number].some(item => item.toLowerCase() === value.toLowerCase()));
      patch.account = candidates.length === 1 ? candidates[0].id : '';
    } else if (key) patch[key] = value;
  }
  return patch;
}

export function orderSummary(value: string, fields: OrderFields, accounts: PaymentAccount[]) {
  const errors: (keyof OrderFields | 'value')[] = [];
  if (!value.trim() || value.trim().length > 200) errors.push('value');
  const total = conversationalAmount(fields.total);
  const advance = conversationalAmount(fields.advance);
  if (total === null) errors.push('total');
  if (advance === null || (total !== null && advance > total)) errors.push('advance');
  if (!accounts.some(account => account.is_active && account.id === fields.account)) errors.push('account');
  let weight: number | undefined;
  let quantity: number | undefined;
  try { if (fields.weight.trim()) weight = parseParcelWeightKg(fields.weight); } catch { errors.push('weight'); }
  try { if (fields.quantity.trim()) quantity = parseParcelQuantity(fields.quantity); } catch { errors.push('quantity'); }
  const payload: OrderInput | null = errors.length ? null : {
    product_name: value.trim(), total_minor: total!, required_advance_minor: advance!, payment_account_id: fields.account,
    ...(weight === undefined ? {} : { parcel_weight_grams: weight }),
    ...(quantity === undefined ? {} : { parcel_quantity: quantity }),
  };
  return { errors, payload };
}
