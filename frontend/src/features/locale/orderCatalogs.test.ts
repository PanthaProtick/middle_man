import { describe, expect, it } from 'vitest';
import { orderCopy } from './orderCopy';
import { orderCreationCopy } from './orderCreationCopy';
import { orderDiagnosticCopy } from './orderDiagnosticCopy';
import { buyerLinkCopy } from './buyerLinkCopy';
import { exportCopy } from './exportCopy';

const catalogs: Record<string, { en: Record<string, string>; bn: Record<string, string> }> = {
  orders: orderCopy, creation: orderCreationCopy, diagnostics: orderDiagnosticCopy, links: buyerLinkCopy,
  exports: exportCopy,
};
describe.each(Object.entries(catalogs))('%s vocabulary', (_name, copy) => {
  it('has nonempty Bengali and English translations with matching interpolation parameters', () => {
    expect(Object.keys(copy.bn).sort()).toEqual(Object.keys(copy.en).sort());
    for (const key of Object.keys(copy.en)) {
      expect(copy.en[key].trim()).not.toBe(''); expect(copy.bn[key].trim()).not.toBe('');
      const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
      expect(placeholders(copy.bn[key])).toEqual(placeholders(copy.en[key]));
    }
  });
});
