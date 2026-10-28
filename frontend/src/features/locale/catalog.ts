import { enBuyerErrors, bnBuyerErrors } from './buyerErrors';
import { enBuyerLocations, bnBuyerLocations } from './buyerLocations';
import type { Locale } from './storage';
import { enBuyerMessages, bnBuyerMessages } from './buyerMessages';

const englishCatalog = {
  ...enBuyerMessages,
  ...enBuyerLocations,
  ...enBuyerErrors,
  'locale.label': 'Language',
  'locale.bengali': 'বাংলা',
  'locale.english': 'English',
  'locale.announcement': 'Language: {language}',

  'document.title.buyer': 'Order confirmation · middleman',
  'document.title.seller': 'Seller workspace · middleman',
  'portal.brand': 'Order confirmation',
  'portal.backHome': 'Back to Home',
  'portal.footerNotice': 'Never share your PIN or OTP. Your seller reviews the order and payment details.',

  'buyer.loading': 'Loading order details…',
  'buyer.loadError.title': 'Unable to Load Order',
  'buyer.loadError.retry': 'Retry',
  'buyer.gate.title': 'Public Access Disabled',
  'buyer.gate.body': 'Public buyer access is disabled until access/projection policy is settled',
  'buyer.errors.offline': 'You are offline. Showing the last saved status.',
  'buyer.errors.refreshFailed': 'Unable to refresh. Showing the last saved status. Please retry.',
  'buyer.errors.orderUnavailable': 'Order record unavailable. Please contact the seller.',
  'buyer.errors.loadFailed': 'Unable to load order. Please retry.',

  'buyer.order.badge': 'Your order',
  'buyer.order.item': 'Item',
  'buyer.order.total': 'Total',
  'buyer.order.advance': 'Delivery advance',
  'buyer.order.advanceHelp': 'Pay this before delivery.',
  'buyer.order.advanceAccepted': 'Advance accepted by the seller',
  'buyer.order.advanceAcceptedHelp': 'The seller has accepted this advance in their records.',
  'buyer.order.cod': 'Remaining COD balance',
  'buyer.order.codExpected': 'Expected remaining COD',
  'buyer.order.codHelp': 'Pay this when your order is delivered.',
  'buyer.order.codExpectedHelp':
    'Estimated from the required advance. The seller confirms the final amount.',
  'buyer.order.sendAdvance': 'Send the advance to the seller’s account',
  'buyer.order.copy': 'Copy',
  'buyer.order.copied': 'Copied',
  'buyer.order.copyFailed': 'Could not copy. Please select the number manually.',
  'buyer.order.validUntil': 'Valid until',

  'buyer.status.pending.title': 'Pending Seller Review',
  'buyer.status.pending.body':
    'Your details and payment claim have been recorded for seller review. Submitted orders do not expire automatically.',
  'buyer.status.confirmed.title': 'Order Confirmed',
  'buyer.status.confirmed.body':
    'The seller has accepted your delivery advance. Your order is now in progress.',
  'buyer.status.expired.title': 'Order Link Expired',
  'buyer.status.expired.body':
    'This link was not completed before the 48-hour deadline. Please contact the seller for a new link.',
  'buyer.status.rejected.title': 'Order Declined',
  'buyer.status.rejected.body': 'Please contact the seller on Facebook/Messenger for further details.',
  'buyer.status.cancelled.title': 'Order Cancelled',
  'buyer.status.cancelled.body': 'Please contact the seller on Facebook/Messenger for further details.',
  'buyer.status.reference': 'Reference',
  'buyer.status.product': 'Product',
  'buyer.status.total': 'Total',
  'buyer.status.acceptedAdvance': 'Advance accepted by the seller',
  'buyer.status.remainingCod': 'Remaining COD balance',
  'buyer.status.expectedCod': 'Expected remaining COD',
  'buyer.status.refresh': 'Refresh Status',
  'buyer.status.checking': 'Checking…',
  'buyer.status.pollingHelp': 'Checks every 30 seconds while visible; retries may take longer.',
} as const;

export type MessageKey = keyof typeof englishCatalog;

const bengaliCatalog: Record<MessageKey, string> = {
  ...bnBuyerMessages,
  ...bnBuyerLocations,
  ...bnBuyerErrors,
  'locale.label': 'ভাষা',
  'locale.bengali': 'বাংলা',
  'locale.english': 'English',
  'locale.announcement': 'ভাষা: {language}',

  'document.title.buyer': 'অর্ডার নিশ্চিতকরণ · middleman',
  'document.title.seller': 'বিক্রেতার কর্মক্ষেত্র · middleman',
  'portal.brand': 'অর্ডার নিশ্চিতকরণ',
  'portal.backHome': 'হোমে ফিরুন',
  'portal.footerNotice':
    'আপনার পিন বা ওটিপি কারও সাথে শেয়ার করবেন না। অর্ডার ও পেমেন্টের তথ্য বিক্রেতা পর্যালোচনা করেন।',

  'buyer.loading': 'অর্ডার লোড হচ্ছে…',
  'buyer.loadError.title': 'অর্ডার দেখা যাচ্ছে না',
  'buyer.loadError.retry': 'আবার চেষ্টা করুন',
  'buyer.gate.title': 'পাবলিক অ্যাক্সেস বন্ধ আছে',
  'buyer.gate.body': 'অ্যাক্সেস ও ডেটা দেখানোর নীতি চূড়ান্ত না হওয়া পর্যন্ত ক্রেতার পাবলিক অ্যাক্সেস বন্ধ আছে।',
  'buyer.errors.offline': 'আপনি অফলাইনে আছেন। শেষ সংরক্ষিত স্ট্যাটাস দেখানো হচ্ছে।',
  'buyer.errors.refreshFailed': 'নতুন স্ট্যাটাস আনা যায়নি। শেষ সংরক্ষিত স্ট্যাটাস দেখানো হচ্ছে। আবার চেষ্টা করুন।',
  'buyer.errors.orderUnavailable': 'অর্ডারের তথ্য পাওয়া যাচ্ছে না। বিক্রেতার সাথে যোগাযোগ করুন।',
  'buyer.errors.loadFailed': 'অর্ডার লোড করা যায়নি। আবার চেষ্টা করুন।',

  'buyer.order.badge': 'আপনার অর্ডার',
  'buyer.order.item': 'পণ্য',
  'buyer.order.total': 'মোট মূল্য',
  'buyer.order.advance': 'ডেলিভারির আগে অগ্রিম',
  'buyer.order.advanceHelp': 'ডেলিভারির আগে এই টাকা পরিশোধ করুন।',
  'buyer.order.advanceAccepted': 'বিক্রেতার গ্রহণ করা অগ্রিম',
  'buyer.order.advanceAcceptedHelp': 'বিক্রেতা নিজের হিসাবে এই অগ্রিম গ্রহণ করেছেন।',
  'buyer.order.cod': 'ডেলিভারির সময় বাকি পরিশোধ',
  'buyer.order.codExpected': 'ডেলিভারির সময় আনুমানিক বাকি পরিশোধ',
  'buyer.order.codHelp': 'অর্ডার ডেলিভারির সময় এই টাকা পরিশোধ করুন।',
  'buyer.order.codExpectedHelp':
    'প্রয়োজনীয় অগ্রিমের ভিত্তিতে এটি আনুমানিক। চূড়ান্ত পরিমাণ বিক্রেতা নিশ্চিত করবেন।',
  'buyer.order.sendAdvance': 'অগ্রিম পাঠানোর নাম্বার',
  'buyer.order.copy': 'কপি করুন',
  'buyer.order.copied': 'কপি হয়েছে',
  'buyer.order.copyFailed': 'কপি করা যায়নি। নাম্বারটি নিজে নির্বাচন করে কপি করুন।',
  'buyer.order.validUntil': 'মেয়াদ শেষ হবে',

  'buyer.status.pending.title': 'বিক্রেতার পর্যালোচনা চলছে',
  'buyer.status.pending.body':
    'আপনার তথ্য ও আপনার দেওয়া পেমেন্টের তথ্য বিক্রেতার পর্যালোচনার জন্য সংরক্ষণ করা হয়েছে। জমা দেওয়া অর্ডারের মেয়াদ স্বয়ংক্রিয়ভাবে শেষ হয় না।',
  'buyer.status.confirmed.title': 'অর্ডার নিশ্চিত করা হয়েছে',
  'buyer.status.confirmed.body':
    'বিক্রেতা আপনার ডেলিভারির আগে অগ্রিম গ্রহণ করেছেন। এখন আপনার অর্ডার এগিয়ে চলছে।',
  'buyer.status.expired.title': 'অর্ডার লিংকের মেয়াদ শেষ',
  'buyer.status.expired.body':
    '48 ঘণ্টার মধ্যে লিংকটি পূরণ করা হয়নি। নতুন লিংকের জন্য বিক্রেতার সাথে যোগাযোগ করুন।',
  'buyer.status.rejected.title': 'অর্ডার গ্রহণ করা হয়নি',
  'buyer.status.rejected.body':
    'আরও তথ্যের জন্য Facebook/Messenger-এ বিক্রেতার সাথে যোগাযোগ করুন।',
  'buyer.status.cancelled.title': 'অর্ডার বাতিল করা হয়েছে',
  'buyer.status.cancelled.body':
    'আরও তথ্যের জন্য Facebook/Messenger-এ বিক্রেতার সাথে যোগাযোগ করুন।',
  'buyer.status.reference': 'রেফারেন্স',
  'buyer.status.product': 'পণ্য',
  'buyer.status.total': 'মোট মূল্য',
  'buyer.status.acceptedAdvance': 'বিক্রেতার গ্রহণ করা অগ্রিম',
  'buyer.status.remainingCod': 'ডেলিভারির সময় বাকি পরিশোধ',
  'buyer.status.expectedCod': 'ডেলিভারির সময় আনুমানিক বাকি পরিশোধ',
  'buyer.status.refresh': 'স্ট্যাটাস রিফ্রেশ করুন',
  'buyer.status.checking': 'চেক করা হচ্ছে…',
  'buyer.status.pollingHelp':
    'পেজ খোলা থাকলে প্রতি 30 সেকেন্ডে চেক করা হয়; আবার চেষ্টা করতে বেশি সময় লাগতে পারে।',
};

export const catalogs: Record<Locale, Record<MessageKey, string>> = {
  en: englishCatalog,
  bn: bengaliCatalog,
};

export type MessageParams = Record<string, string | number>;

export function interpolate(message: string, params: MessageParams = {}): string {
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}
