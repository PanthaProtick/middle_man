import { describe, expect, it } from 'vitest';
import { asciiDigits, formatOrderAmount, orderAmountMinor } from './orderNumbers';

describe('seller numeric boundaries', () => {
  it('normalizes Bengali digits for numeric inputs without changing free text', () => {
    expect(asciiDigits('০১২৩৪৫৬৭৮৯')).toBe('0123456789');
    expect(asciiDigits('২.৫ কেজি')).toBe('2.5 কেজি');
  });

  it('formats integer minor units without losing cents at the safe-integer boundary', () => {
    expect(formatOrderAmount(50050)).toBe('500.50');
    expect(formatOrderAmount(1)).toBe('0.01');
    expect(formatOrderAmount(-50050)).toBe('-500.50');
    expect(formatOrderAmount(Number.MAX_SAFE_INTEGER)).toBe('90,071,992,547,409.91');
  });

  it('parses amounts exactly at the supported safe-integer boundary', () => {
    expect(orderAmountMinor('90071992547409.91')).toBe(Number.MAX_SAFE_INTEGER);
    expect(orderAmountMinor('১০০.০১')).toBe(10001);
    expect(orderAmountMinor('0.00')).toBeNull();
  });
});
