import { describe, expect, it } from 'vitest';
import { formatBangladeshDateTime, formatBdt } from './format';

describe('locale formatting', () => {
  it('formats money with two decimals and 0-9 digits', () => {
    expect(formatBdt(300000)).toBe('৳3,000.00');
    expect(formatBdt(50050)).toBe('৳500.50');
    expect(formatBdt(50050)).not.toMatch(/[০-৯]/);
  });

  it('formats Bangladesh time with an English Gregorian month name', () => {
    const formatted = formatBangladeshDateTime('2026-10-24T12:00:00Z', 'en');
    expect(formatted).toContain('24 Oct 2026');
    expect(formatted).toContain('06:00');
    expect(formatted).toContain('BST / UTC+6');
    expect(formatted).not.toMatch(/[০-৯]/);
  });

  it('localizes Gregorian month names while keeping 0-9 digits', () => {
    const formatted = formatBangladeshDateTime('2026-10-24T12:00:00Z', 'bn');
    expect(formatted).toContain('24 অক্টোবর 2026');
    expect(formatted).toContain('BST / UTC+6');
    expect(formatted).not.toMatch(/[০-৯]/);
  });

  it('returns an unparseable timestamp unchanged', () => {
    expect(formatBangladeshDateTime('not-a-date', 'bn')).toBe('not-a-date');
  });
});
