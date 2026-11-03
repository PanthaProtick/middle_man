import type { OrderFields } from './guidedOrder';

const number = '[0-9০-৯]+(?:[,.][0-9০-৯]+)*';
const currency = '(?:taka|takar|টাকার|টাকা|BDT|Tk\\.?)';
type Candidates = Partial<OrderFields & { value: string }>;

/** Bounded sentence templates produce editable candidates, never executable actions. */
export function orderMessageCandidates(message: string): Candidates {
  const patch: Candidates = {};
  let firstAmountCue = message.length;
  for (const [key, cue] of [['total', 'total|মোট(?: মূল্য| দাম)?|mot'],
    ['advance', '(?:delivery\\s+)?advance|অগ্রিম|ogrim']] as const) {
    const matches = [...message.matchAll(new RegExp(
      `(?:^|[\\s;,])(?:${cue})\\s+(?:BDT\\s*|৳\\s*)?(${number})(?=\\s|[;,।]|$)`, 'gi'))];
    if (matches.length) {
      firstAmountCue = Math.min(firstAmountCue, matches[0].index!);
      patch[key] = matches.length === 1 ? matches[0][1] : '';
    }
  }
  // Only the creation clause supplies a product; follow-up messages keep it intact.
  const clause = message.slice(0, firstAmountCue).split(/,(?![0-9০-৯])|;|\n/)[0].trim();
  const prefix = /^(?:please\s+)?(?:create|make|add|new|notun)\s+(?:an?\s+)?order\s+(?:for\s+)?/i;
  const suffix = /\s+(?:এর\s+)?অর্ডার\s*(?:তৈরি|কর)[^,;]*$/;
  let product: string | undefined;
  if (prefix.test(clause)) product = clause.replace(prefix, '');
  else if (suffix.test(clause)) product = clause.replace(suffix, '');
  if (product === undefined || /[:=]/.test(product)) return patch;
  const priced = product.match(new RegExp(`^(${number})\\s*${currency}(?:\\s+(.+))?$`, 'i'));
  if (priced) {
    patch.total ??= priced[1];
    product = priced[2] ?? '';
  }
  if (product.trim()) patch.value = product.trim();
  return patch;
}
