import { describe, expect, it } from 'vitest';
import { formatBangladeshDateTime, formatBdt, normalizeBengaliDigits } from './format';

describe('locale formatting', () => {
  it('formats money with two decimals and 0-9 digits', () => {
    expect(formatBdt(300000)).toBe('৳3,000.00');
    expect(formatBdt(50050)).toBe('৳500.50');
    expect(formatBdt(50050)).not.toMatch(/[০-৯]/);
  });

  it('formats integer minor units exactly at the safe-integer boundary and keeps signs', () => {
    expect(formatBdt(Number.MAX_SAFE_INTEGER)).toBe('৳90,071,992,547,409.91');
    expect(formatBdt(1)).toBe('৳0.01');
    expect(formatBdt(-50050)).toBe('৳-500.50');
    expect(formatBdt(Number.NaN)).toBe('৳NaN');
    expect(formatBdt(50050)).not.toMatch(/[০-৯]/);
  });

  it('normalizes Bengali digits without rewriting other characters', () => {
    expect(normalizeBengaliDigits('০১২৩৪৫৬৭৮৯')).toBe('0123456789');
    expect(normalizeBengaliDigits('১২.০১ ঠিকানা Road 5')).toBe('12.01 ঠিকানা Road 5');
    expect(normalizeBengaliDigits('ABC-123')).toBe('ABC-123');
  });

  it('formats Bangladesh time with a localized label and English Gregorian month name', () => {
    const formatted = formatBangladeshDateTime('2026-10-24T12:00:00Z', 'en');
    expect(formatted).toContain('24 Oct 2026');
    expect(formatted).toContain('06:00');
    expect(formatted).toContain('Bangladesh time');
    expect(formatted).not.toContain('BST');
    expect(formatted).not.toMatch(/[০-৯]/);
  });

  it('localizes the Bangladesh time label and Gregorian month names while keeping 0-9 digits', () => {
    const formatted = formatBangladeshDateTime('2026-10-24T12:00:00Z', 'bn');
    expect(formatted).toContain('24 অক্টোবর 2026');
    expect(formatted).toContain('বাংলাদেশ সময়');
    expect(formatted).not.toContain('BST');
    expect(formatted).not.toMatch(/[০-৯]/);
  });

  it('returns an unparseable timestamp unchanged', () => {
    expect(formatBangladeshDateTime('not-a-date', 'bn')).toBe('not-a-date');
  });
});
