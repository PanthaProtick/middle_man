import { describe, expect, it } from 'vitest';
import { catalogs, type MessageKey } from './catalog';

const placeholders = (message: string): string[] =>
  [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe('locale catalogs', () => {
  it('defines every required key in both languages with non-empty copy', () => {
    const englishKeys = Object.keys(catalogs.en).sort();
    const bengaliKeys = Object.keys(catalogs.bn).sort();

    expect(bengaliKeys).toEqual(englishKeys);
    for (const key of englishKeys as MessageKey[]) {
      expect(catalogs.en[key].trim()).not.toBe('');
      expect(catalogs.bn[key].trim()).not.toBe('');
    }
  });

  it('keeps interpolation placeholders in parity across languages', () => {
    for (const key of Object.keys(catalogs.en) as MessageKey[]) {
      expect(placeholders(catalogs.bn[key])).toEqual(placeholders(catalogs.en[key]));
    }
  });

  it('keeps the approved delivery and remaining-balance vocabulary', () => {
    expect(catalogs.bn['buyer.order.advance']).toBe('ডেলিভারির আগে অগ্রিম');
    expect(catalogs.bn['buyer.order.cod']).toBe('ডেলিভারির সময় বাকি পরিশোধ');
    expect(catalogs.bn['buyer.order.cod']).not.toMatch(/[০-৯]/);
  });
});
