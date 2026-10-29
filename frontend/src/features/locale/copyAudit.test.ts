import { describe, expect, it } from 'vitest';
import { bnBuyerErrors, enBuyerErrors } from './buyerErrors';
import { bnBuyerLocations, enBuyerLocations } from './buyerLocations';
import { bnBuyerMessages, enBuyerMessages } from './buyerMessages';
import { buyerLinkCopy } from './buyerLinkCopy';
import { catalogs } from './catalog';
import { correctionOutcomeCopy } from './correctionOutcomeCopy';
import { courierBengali } from './courierCopy';
import { exportCopy } from './exportCopy';
import { historyBengali, historyText } from './historyCopy';
import { orderCopy } from './orderCopy';
import { orderCreationCopy } from './orderCreationCopy';
import { orderDiagnosticCopy } from './orderDiagnosticCopy';
import { paymentExceptionCopy, paymentExceptionReasons, paymentReason } from './paymentExceptionCopy';
import { paymentInboxBengali } from './paymentInboxCopy';
import { receiptBengali, receiptText } from './receiptCopy';
import { sellerCopy } from './sellerCopy';

type Copy = Record<string, string>;
type PairedCopy = { en: Copy; bn: Copy };

/**
 * Static parity audit over copy modules, independent of the components that
 * consume them. It proves key/placeholder parity and lookup resolution, but it
 * cannot see copy written directly in JSX; rendered locale tests cover those
 * seams. The paired group carries both languages in one module; the keyed group
 * is an English-keyed Bengali dictionary used through a lookup function.
 */
const pairedCopies: Record<string, PairedCopy> = {
  catalogs,
  buyerLinkCopy,
  orderCopy,
  orderCreationCopy,
  orderDiagnosticCopy,
  correctionOutcomeCopy,
  exportCopy,
  sellerCopy,
  buyerMessages: { en: enBuyerMessages, bn: bnBuyerMessages },
  buyerLocations: { en: enBuyerLocations, bn: bnBuyerLocations },
  buyerErrors: { en: enBuyerErrors, bn: bnBuyerErrors },
  paymentExceptionCopy,
};

const keyedBengali: Record<string, Copy> = {
  courierBengali,
  historyBengali,
  paymentInboxBengali,
  receiptBengali,
};

/**
 * Brand, provider, and format terms that stay identical in both languages.
 * `বাংলা` is identical by design: the switch always labels the other language in
 * its own script so it stays findable from either mode.
 */
const IDENTICAL_TERMS = new Set([
  'বাংলা',
  'SMS',
  'TrxID',
  'Pathao',
  'Facebook/Messenger',
  'BDT',
  'Gemini',
  'Google',
  'English',
]);

const placeholders = (message: string): string[] =>
  [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe.each(Object.entries(pairedCopies))('%s copy', (_name, copy) => {
  it('defines the same non-empty keys in both languages', () => {
    expect(Object.keys(copy.bn).sort()).toEqual(Object.keys(copy.en).sort());
    for (const key of Object.keys(copy.en)) {
      expect(copy.en[key].trim(), `English ${key}`).not.toBe('');
      expect(copy.bn[key].trim(), `Bengali ${key}`).not.toBe('');
    }
  });

  it('keeps interpolation placeholders in parity', () => {
    for (const key of Object.keys(copy.en)) {
      expect(placeholders(copy.bn[key]), `Bengali ${key}`).toEqual(placeholders(copy.en[key]));
    }
  });

  it('leaves no untranslated Bengali value outside documented terms', () => {
    const untranslated = Object.keys(copy.en)
      .filter((key) => copy.bn[key] === copy.en[key] && !IDENTICAL_TERMS.has(copy.bn[key]))
      .map((key) => `${key}: ${copy.bn[key]}`);
    expect(untranslated).toEqual([]);
  });
});

describe.each(Object.entries(keyedBengali))('%s dictionary', (_name, copy) => {
  it('has a non-empty Bengali value for every English lookup key', () => {
    for (const [key, value] of Object.entries(copy)) {
      expect(key.trim()).not.toBe('');
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('leaves no untranslated value outside documented terms', () => {
    const untranslated = Object.entries(copy)
      .filter(([key, value]) => value === key && !IDENTICAL_TERMS.has(value))
      .map(([key, value]) => `${key}: ${value}`);
    expect(untranslated).toEqual([]);
  });
});

describe('keyed lookups resolve known Bengali values', () => {
  it('does not fall back to English for known history, receipt, and payment-reason keys', () => {
    for (const [key, value] of Object.entries(historyBengali)) {
      expect(historyText('bn', key), key).toBe(value);
    }
    for (const [key, value] of Object.entries(receiptBengali)) {
      expect(receiptText('bn', key), key).toBe(value);
    }
    for (const [code, [english, bengali]] of Object.entries(paymentExceptionReasons)) {
      expect(paymentReason(code, 'en'), code).toBe(english);
      expect(paymentReason(code, 'bn'), code).toBe(bengali);
    }
  });
});

describe('approved glossary vocabulary is used consistently', () => {
  it('uses the agreed delivery, confirmation, proof, and courier-draft wording', () => {
    expect(catalogs.bn['buyer.order.advance']).toBe('ডেলিভারির আগে অগ্রিম');
    expect(catalogs.bn['buyer.order.cod']).toBe('ডেলিভারির সময় বাকি পরিশোধ');
    expect(correctionOutcomeCopy.bn.locked).toContain('নিশ্চিত করা অর্ডার');
    expect(paymentExceptionCopy.bn.caption).toContain('ক্রেতার দেওয়া পেমেন্টের তথ্য');
    expect(paymentExceptionCopy.bn.cod).toContain('ডেলিভারির সময় বাকি পরিশোধ');
    expect(courierBengali['Courier proposal']).toBe('কুরিয়ার অনুরোধের খসড়া');
    expect(orderCopy.en.actualCod).toContain('Remaining COD balance');
    expect(orderCopy.en.expectedCod).toContain('Expected remaining COD balance');
    expect(orderCopy.en.actualRemaining).toBe('Remaining COD balance');
    expect(orderCopy.en.expectedRemaining).toBe('Expected remaining COD balance');
    expect(orderCreationCopy.en.cod).toContain('Expected remaining COD balance');
    expect(exportCopy.en.actualCod).toBe('Remaining COD balance');
    expect(exportCopy.en.expectedCod).toBe('Expected remaining COD balance');
  });

  it('does not leave an ambiguous BST label next to the localized time zone', () => {
    expect(orderCopy.en.deadline).toBe('Deadline:');
    expect(orderCopy.en.deadline).not.toContain('BST');
  });
});
