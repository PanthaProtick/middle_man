import { describe, expect, it } from 'vitest';
import {
  bangladeshToday,
  lastDaysRange,
  parseDayCount,
  shiftIsoDate,
  validateCustomRange,
  validateDayCount,
} from './orderDateFilter';

const at = (iso: string) => new Date(iso);

describe('bangladeshToday', () => {
  it('uses the Bangladesh calendar day around UTC midnight', () => {
    expect(bangladeshToday(at('2026-10-27T17:59:59.999Z'))).toBe('2026-10-27');
    expect(bangladeshToday(at('2026-10-27T18:00:00.000Z'))).toBe('2026-10-28');
  });
});

describe('shiftIsoDate', () => {
  it('moves date-only values across month and year boundaries', () => {
    expect(shiftIsoDate('2026-10-28', -1)).toBe('2026-10-27');
    expect(shiftIsoDate('2026-10-28', 1)).toBe('2026-10-29');
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftIsoDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftIsoDate('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('lastDaysRange', () => {
  const now = at('2026-10-28T10:00:00.000Z');

  it('includes today and the prior days for 1, 7, and 3650 day ranges', () => {
    expect(lastDaysRange(1, now)).toEqual({ from: '2026-10-28', to: '2026-10-28' });
    expect(lastDaysRange(7, now)).toEqual({ from: '2026-10-22', to: '2026-10-28' });
    expect(lastDaysRange(3650, now)).toEqual({ from: '2016-10-31', to: '2026-10-28' });
  });

  it('captures the Dhaka day when the caller supplies a fixed clock', () => {
    expect(lastDaysRange(7, at('2026-10-27T18:00:00.000Z'))).toEqual({
      from: '2026-10-22',
      to: '2026-10-28',
    });
  });
});

describe('validateCustomRange', () => {
  it('accepts equal, ordered, and future end dates', () => {
    expect(validateCustomRange('2026-10-28', '2026-10-28')).toBeNull();
    expect(validateCustomRange('2026-10-01', '2026-10-28')).toBeNull();
    expect(validateCustomRange(' 2026-10-28 ', ' 2099-12-31 ')).toBeNull();
  });

  it('requires both dates', () => {
    expect(validateCustomRange('', '2026-10-28')).toBe('range_required');
    expect(validateCustomRange('2026-10-28', '')).toBe('range_required');
    expect(validateCustomRange('   ', '   ')).toBe('range_required');
  });

  it('rejects malformed and impossible dates', () => {
    expect(validateCustomRange('28/10/2026', '2026-10-28')).toBe('range_invalid');
    expect(validateCustomRange('2026-02-30', '2026-03-01')).toBe('range_invalid');
    expect(validateCustomRange('2026-13-01', '2026-13-02')).toBe('range_invalid');
    expect(validateCustomRange('2026-10-28', 'not-a-date')).toBe('range_invalid');
  });

  it('rejects a reversed range', () => {
    expect(validateCustomRange('2026-10-29', '2026-10-28')).toBe('range_reversed');
  });
});

describe('validateDayCount', () => {
  it('accepts whole numbers from 1 to 3650, including Bengali digits', () => {
    expect(validateDayCount('1')).toBeNull();
    expect(validateDayCount('3650')).toBeNull();
    expect(validateDayCount(' 7 ')).toBeNull();
    expect(validateDayCount('০৭')).toBeNull();
    expect(parseDayCount('৩০')).toBe(30);
  });

  it('rejects zero, out-of-range, fractional, blank, and non-numeric values', () => {
    for (const value of ['0', '3651', '1.5', '', '  ', 'abc', '-1', '+7', '১.৫']) {
      expect(validateDayCount(value)).toBe('days_invalid');
    }
    expect(parseDayCount('abc')).toBeNull();
  });
});
