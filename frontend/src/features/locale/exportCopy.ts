import { lifecycleLabel, orderCopy } from './orderCopy';
import type { Locale } from './storage';

const en = {
  copyDeliverySummary: 'Copy delivery summary',
  downloadEnglishCsv: 'Download English CSV',
  downloadFilteredEnglishCsv: 'Download filtered English CSV',
  preparing: 'Preparing…',
  purpose: 'Manual delivery aid only; no courier booking, update or delivery-price calculation.',
  summaryCopied: 'Summary copied.',
  csvStarted: 'English CSV download started.',
  noOrdersMatch: 'No orders match this filter.',
  clipboardDenied: 'Could not copy the summary. Please retry.',
  rateLimited: 'Too many export requests. Wait a minute, then try again.',
  tooManyOrders: 'Too many orders to export. Narrow the status filter and try again.',
  exportUnavailable: 'CSV download is unavailable right now. Please retry.',
  unauthorized: 'Sign in with the seller account that owns these orders.',
  fallbackError: 'Copy or CSV download is unavailable. Please retry.',

  order: 'Order',
  product: 'Product',
  lifecycle: 'Lifecycle',
  buyer: 'Buyer',
  contact: 'Contact',
  address: 'Address',
  fixedTotal: 'Fixed total',
  requiredAdvance: 'Required advance',
  acceptedAdvance: 'Accepted advance',
  expectedCod: 'Expected COD',
  actualCod: 'Actual COD',
  notAccepted: 'Not accepted',
} as const;

const bn: Record<keyof typeof en, string> = {
  copyDeliverySummary: 'ডেলিভারির সারসংক্ষেপ কপি করুন',
  downloadEnglishCsv: 'ইংরেজি CSV ডাউনলোড করুন',
  downloadFilteredEnglishCsv: 'ফিল্টার করা ইংরেজি CSV ডাউনলোড করুন',
  preparing: 'প্রস্তুত করা হচ্ছে…',
  purpose: 'ম্যানুয়াল ডেলিভারির সহায়তার জন্য; কোনো কুরিয়ার বুকিং, হালনাগাদ বা ডেলিভারি খরচের হিসাব নয়।',
  summaryCopied: 'সারসংক্ষেপ কপি হয়েছে।',
  csvStarted: 'ইংরেজি CSV ডাউনলোড শুরু হয়েছে।',
  noOrdersMatch: 'এই ফিল্টারে কোনো অর্ডার নেই।',
  clipboardDenied: 'সারসংক্ষেপ কপি করা যায়নি। দয়া করে আবার চেষ্টা করুন।',
  rateLimited: 'অনেকবার ডাউনলোডের অনুরোধ হয়েছে। এক মিনিট অপেক্ষা করে আবার চেষ্টা করুন।',
  tooManyOrders: 'ডাউনলোডের জন্য অর্ডারের সংখ্যা বেশি। অবস্থার ফিল্টার কমিয়ে আবার চেষ্টা করুন।',
  exportUnavailable: 'এই মুহূর্তে CSV ডাউনলোড করা যাচ্ছে না। দয়া করে আবার চেষ্টা করুন।',
  unauthorized: 'এই অর্ডারগুলোর বিক্রেতা অ্যাকাউন্ট দিয়ে সাইন ইন করুন।',
  fallbackError: 'কপি বা CSV ডাউনলোড এই মুহূর্তে সম্ভব নয়। দয়া করে আবার চেষ্টা করুন।',

  order: 'অর্ডার',
  product: 'পণ্য',
  lifecycle: 'অবস্থা',
  buyer: 'ক্রেতা',
  contact: 'যোগাযোগ',
  address: 'ঠিকানা',
  fixedTotal: 'সম্মত মোট মূল্য',
  requiredAdvance: 'ডেলিভারির আগে প্রয়োজনীয় অগ্রিম',
  acceptedAdvance: 'গৃহীত অগ্রিম',
  expectedCod: 'ডেলিভারির সময় সম্ভাব্য বাকি পরিশোধ',
  actualCod: 'ডেলিভারির সময় বাকি পরিশোধ',
  notAccepted: 'গ্রহণ করা হয়নি',
};

export const exportCopy = { en, bn };

export type ExportCopy = typeof en;

/** Server-provided values stay verbatim; only labels and the purpose sentence are localized. */
export interface ExportOrderSummary {
  order_id: string;
  product: string;
  lifecycle: string;
  buyer_name: string;
  contact_number: string;
  address: string;
  total_bdt: string;
  required_advance_bdt: string;
  accepted_advance_bdt: string;
  expected_cod_bdt: string;
  actual_cod_bdt: string;
}

export type ExportFailureCode =
  | 'clipboard' | 'rate_limited' | 'too_many' | 'unavailable' | 'unauthorized' | 'unknown';

export type ExportFeedback =
  | { kind: 'copied' }
  | { kind: 'started' }
  | { kind: 'empty' }
  | { kind: 'error'; code: ExportFailureCode };

export function summaryText(summary: ExportOrderSummary, locale: Locale): string {
  const text = exportCopy[locale];
  const acceptsAdvance = summary.accepted_advance_bdt
    ? `${text.acceptedAdvance}: BDT ${summary.accepted_advance_bdt}`
    : `${text.acceptedAdvance}: ${text.notAccepted}`;
  const actualCod = summary.actual_cod_bdt
    ? `${text.actualCod}: BDT ${summary.actual_cod_bdt}`
    : `${text.actualCod}: ${text.notAccepted}`;
  return [
    `${text.order}: ${summary.order_id}`,
    `${text.product}: ${summary.product}`,
    `${text.lifecycle}: ${lifecycleLabel(summary.lifecycle, orderCopy[locale])}`,
    `${text.buyer}: ${summary.buyer_name}`,
    `${text.contact}: ${summary.contact_number}`,
    `${text.address}: ${summary.address}`,
    `${text.fixedTotal}: BDT ${summary.total_bdt}`,
    `${text.requiredAdvance}: BDT ${summary.required_advance_bdt}`,
    acceptsAdvance,
    `${text.expectedCod}: BDT ${summary.expected_cod_bdt}`,
    actualCod,
    text.purpose,
  ].join('\n');
}

export function failureCode(status: number): ExportFailureCode {
  switch (status) {
    case 429: return 'rate_limited';
    case 422: return 'too_many';
    case 503: return 'unavailable';
    case 401: return 'unauthorized';
    default: return 'unknown';
  }
}

export function feedbackMessage(
  feedback: ExportFeedback,
  locale: Locale,
): { message: string; failed: boolean } {
  const text = exportCopy[locale];
  switch (feedback.kind) {
    case 'copied': return { message: text.summaryCopied, failed: false };
    case 'started': return { message: text.csvStarted, failed: false };
    case 'empty': return { message: text.noOrdersMatch, failed: false };
    case 'error': {
      switch (feedback.code) {
        case 'clipboard': return { message: text.clipboardDenied, failed: true };
        case 'rate_limited': return { message: text.rateLimited, failed: true };
        case 'too_many': return { message: text.tooManyOrders, failed: true };
        case 'unavailable': return { message: text.exportUnavailable, failed: true };
        case 'unauthorized': return { message: text.unauthorized, failed: true };
        default: return { message: text.fallbackError, failed: true };
      }
    }
  }
}
