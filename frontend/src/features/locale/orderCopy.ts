const en = {
  list: 'Orders & Active Buyer Links', confirmed: 'Confirmed', exceptions: 'Review Exceptions:', status: 'Status:',
  all: 'All Statuses', awaiting_buyer: 'Awaiting Buyer', pending: 'Pending Review', rejected: 'Rejected',
  cancelled: 'Cancelled', expired: 'Expired', unknown: 'Unknown status. Refresh and review the order before continuing.',
  empty: 'No orders found. Click "Create Order Link" above to create an order and share its link with a buyer.',
  inspect: 'Inspect', inspectTitle: 'Inspect order details and snapshot', total: 'Total:', advance: 'Advance:',
  actualCod: 'Actual COD:', expectedCod: 'Expected COD:', account: 'Account:', review: 'Review:',
  hideCodes: 'Hide codes', showCodes: 'Show codes', toggleCodes: 'Toggle raw technical review codes',
  created: 'Created:', expiredAt: 'Expired at:', deadline: 'Deadline (BST):', more: 'Load More Orders',
  details: 'Order & Link Details', closeDetails: 'Close order details', close: 'Close',
  overviewTab: 'Overview', paymentTab: 'Payment', deliveryTab: 'Delivery', buyerTab: 'Buyer & link',
  backTab: 'Back', nextTab: 'Next', reviewPayment: 'Review payment', reviewDelivery: 'Review delivery',
  predecessor: 'Replaces predecessor order:', product: 'Product Name', agreed: 'Total Agreed',
  required: 'Required Advance', actualRemaining: 'Actual Remaining COD', expectedRemaining: 'Expected Remaining COD',
  allocation: 'Confirmed Payment Allocation', basis: 'Basis:', accepted: 'Accepted Advance:', confirmedAt: 'Confirmed At:',
  reviewRequired: 'Review Required', hideErrors: 'Hide error codes', showErrors: 'Show error codes (for dev)',
  snapshot: 'Fixed Receiving Account Snapshot', immutable: 'Immutable destination for this order (deactivating or editing accounts later does not alter this).',
  deadlines: 'Server Deadlines & Lifecycle (Bangladesh Time)', version: 'Version:', deadlineShort: 'Deadline:', expiredShort: 'Expired:',
  automatic: 'Automatic match', manual: 'Seller accepted', unknownBasis: 'Unknown allocation basis. Review payment evidence.',
  confirmationHelp: 'Seller confirmation does not imply independent payment-provider verification.',
  SENDER_MISMATCH: 'Payment sender does not match', AMOUNT_MISMATCH: 'Payment amount does not match',
  TIME_UNCLEAR: 'Payment time needs review', WRONG_RECEIVING_ACCOUNT: 'Receiving account does not match',
  CONFLICTING_RECEIPTS: 'Received-payment records conflict', COMPETING_CLAIMS: 'Multiple orders claim this payment',
  PAYMENT_USED: 'Payment is already used', unknownReview: 'Unknown review reason. Review the payment evidence before continuing.',
  parcel: 'Parcel details', weight: 'Weight (kg)', quantity: 'Quantity', notProvided: 'Not provided',
} as const;
const bn: Record<keyof typeof en, string> = {
  list: 'অর্ডার ও সক্রিয় ক্রেতার লিংক', confirmed: 'নিশ্চিত করা', exceptions: 'পর্যালোচনার অসঙ্গতি:', status: 'অবস্থা:',
  all: 'সব অবস্থা', awaiting_buyer: 'ক্রেতার অপেক্ষায়', pending: 'পর্যালোচনার অপেক্ষায়', rejected: 'প্রত্যাখ্যাত',
  cancelled: 'বাতিল', expired: 'মেয়াদ শেষ', unknown: 'অজানা অবস্থা। রিফ্রেশ করে অর্ডার পর্যালোচনা করুন।',
  empty: 'কোনো অর্ডার পাওয়া যায়নি। উপরের “অর্ডার লিংক তৈরি করুন” থেকে অর্ডার তৈরি করে ক্রেতাকে লিংক পাঠান।',
  inspect: 'বিস্তারিত দেখুন', inspectTitle: 'অর্ডারের বিস্তারিত ও সংরক্ষিত তথ্য দেখুন', total: 'মোট:', advance: 'ডেলিভারির আগে অগ্রিম:',
  actualCod: 'ডেলিভারির সময় বাকি পরিশোধ:', expectedCod: 'ডেলিভারির সময় সম্ভাব্য বাকি পরিশোধ:', account: 'অ্যাকাউন্ট:', review: 'পর্যালোচনা:',
  hideCodes: 'কোড লুকান', showCodes: 'কোড দেখুন', toggleCodes: 'কারিগরি পর্যালোচনার কোড দেখুন বা লুকান',
  created: 'তৈরি হয়েছে:', expiredAt: 'মেয়াদ শেষ হয়েছে:', deadline: 'সময়সীমা (বাংলাদেশ সময়):', more: 'আরও অর্ডার দেখুন',
  details: 'অর্ডার ও লিংকের বিস্তারিত', closeDetails: 'অর্ডারের বিস্তারিত বন্ধ করুন', close: 'বন্ধ করুন',
  overviewTab: 'সারাংশ', paymentTab: 'পেমেন্ট', deliveryTab: 'ডেলিভারি', buyerTab: 'ক্রেতা ও লিংক',
  backTab: 'পেছনে', nextTab: 'পরবর্তী', reviewPayment: 'পেমেন্ট পর্যালোচনা করুন', reviewDelivery: 'ডেলিভারি পর্যালোচনা করুন',
  predecessor: 'আগের যে অর্ডারের বদলে তৈরি:', product: 'পণ্যের নাম', agreed: 'সম্মত মোট মূল্য',
  required: 'ডেলিভারির আগে প্রয়োজনীয় অগ্রিম', actualRemaining: 'ডেলিভারির সময় বাকি পরিশোধ', expectedRemaining: 'ডেলিভারির সময় সম্ভাব্য বাকি পরিশোধ',
  allocation: 'নিশ্চিত করা পেমেন্টের বরাদ্দ', basis: 'ভিত্তি:', accepted: 'গৃহীত ডেলিভারির আগে অগ্রিম:', confirmedAt: 'নিশ্চিত করা হয়েছে:',
  reviewRequired: 'পর্যালোচনা প্রয়োজন', hideErrors: 'ত্রুটির কোড লুকান', showErrors: 'ত্রুটির কোড দেখুন (কারিগরি সহায়তা)',
  snapshot: 'টাকা গ্রহণের অ্যাকাউন্টের স্থির তথ্য', immutable: 'এই অর্ডারের টাকা গ্রহণের গন্তব্য অপরিবর্তনীয়। পরে অ্যাকাউন্ট বন্ধ বা সম্পাদনা করলেও এটি বদলাবে না।',
  deadlines: 'সময়সীমা ও অর্ডারের অবস্থা (বাংলাদেশ সময়)', version: 'সংস্করণ:', deadlineShort: 'সময়সীমা:', expiredShort: 'মেয়াদ শেষ:',
  automatic: 'স্বয়ংক্রিয়ভাবে মেলানো', manual: 'বিক্রেতা গ্রহণ করেছেন', unknownBasis: 'অজানা বরাদ্দের ভিত্তি। পেমেন্টের তথ্য পর্যালোচনা করুন।',
  confirmationHelp: 'বিক্রেতার নিশ্চিতকরণ মানে পেমেন্ট প্রদানকারী স্বাধীনভাবে যাচাই করেছে এমন নয়।',
  SENDER_MISMATCH: 'পেমেন্ট পাঠানোর নাম্বার মিলছে না', AMOUNT_MISMATCH: 'পেমেন্টের অঙ্ক মিলছে না',
  TIME_UNCLEAR: 'পেমেন্টের সময় পর্যালোচনা প্রয়োজন', WRONG_RECEIVING_ACCOUNT: 'টাকা গ্রহণের অ্যাকাউন্ট মিলছে না',
  CONFLICTING_RECEIPTS: 'পাওয়া পেমেন্টের তথ্যে অসঙ্গতি আছে', COMPETING_CLAIMS: 'একই পেমেন্ট একাধিক অর্ডারে দাবি করা হয়েছে',
  PAYMENT_USED: 'পেমেন্ট ইতিমধ্যে ব্যবহার হয়েছে', unknownReview: 'অজানা পর্যালোচনার কারণ। এগোনোর আগে পেমেন্টের তথ্য পর্যালোচনা করুন।',
  parcel: 'পার্সেলের তথ্য', weight: 'ওজন (কেজি)', quantity: 'পরিমাণ', notProvided: 'দেওয়া হয়নি',
};
export const orderCopy = { en, bn };
export type OrderCopy = typeof en | typeof bn;
export function lifecycleLabel(code: string, text: OrderCopy): string {
  switch (code) {
    case 'awaiting_buyer': case 'pending': case 'confirmed': case 'rejected': case 'cancelled': case 'expired': return text[code];
    default: return text.unknown;
  }
}
export function reviewLabel(code: string, text: OrderCopy): string {
  switch (code) {
    case 'SENDER_MISMATCH': case 'AMOUNT_MISMATCH': case 'TIME_UNCLEAR': case 'WRONG_RECEIVING_ACCOUNT':
    case 'CONFLICTING_RECEIPTS': case 'COMPETING_CLAIMS': case 'PAYMENT_USED': return text[code];
    default: return text.unknownReview;
  }
}
export function allocationLabel(code: string | null, text: OrderCopy): string {
  return code === 'automatic' ? text.automatic : code === 'manual' ? text.manual : text.unknownBasis;
}
