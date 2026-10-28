import { formatIntegerMinor, normalizeBengaliDigits } from '../locale/format';

/** Normalize only numeric input boundaries; opaque identifiers and free text stay intact. */
export function asciiDigits(value: string): string {
  return normalizeBengaliDigits(value);
}

export function orderAmountMinor(value: string): number | null {
  const normalized = asciiDigits(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return minor > 0n && minor <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(minor) : null;
}
/** Format safe integer minor units without a floating-point division losing cents. */
export function formatOrderAmount(minor: number): string {
  return formatIntegerMinor(minor);
}
