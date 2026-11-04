/**
 * Current browser-local time in the `YYYY-MM-DDTHH:mm` shape required by a
 * datetime-local input. Defaulting the field saves sellers from selecting a
 * minute just to record that a payment happened now.
 */
export function currentPaymentTime(now: Date = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
