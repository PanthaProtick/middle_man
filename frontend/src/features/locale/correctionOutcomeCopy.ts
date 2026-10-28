import { orderCopy, lifecycleLabel, reviewLabel } from './orderCopy';
import type { Locale } from './storage';

const en = {
  correctionTitle: 'Correct buyer information', loading: 'Loading buyer information…', unavailable: 'Correction unavailable. Refresh and try again.',
  status: 'Status:', showDetails: 'Show review details', hideDetails: 'Hide review details', noReasons: 'No review reasons',
  save: 'Save correction and check again', saveDelivery: 'Save delivery correction', saving: 'Saving…', savingDelivery: 'Saving delivery correction…', retry: 'Retry same correction',
  refresh: 'Refresh order and retain inputs', refreshed: 'Review your retained inputs against the refreshed order before saving.',
  buyerName: 'Buyer name', contact: 'Contact number', address: 'Delivery address', claim: 'Payment claim', provider: 'Provider', transaction: 'Transaction ID', sender: 'Payment sender', advance: 'Claimed advance (BDT)', reason: 'Correction reason',
  locked: 'Payment terms and accepted advance are locked on confirmed orders. Seller confirmation does not imply independent payment-provider verification.',
  history: 'Buyer revision history', revision: 'Revision', initial: 'Initial submission', accepted: 'Payment claim accepted:',
  city: 'City unresolved', zone: 'Zone unresolved', area: 'Area unresolved', bookingBlocked: 'Booking blocked; seller resolution and review required.',
  booked: 'Courier booking is already confirmed in Pathao. Portal corrections do not update courier bookings. Update courier parcels separately in Pathao.',
  submitting: 'Courier submission is in progress. Portal corrections do not update bookings. Check Pathao if booked.',
  unknownBooking: 'Courier submission outcome is unknown. Reconcile the attempt and resolve any booking in Pathao.',
  unsubmitted: 'Unsubmitted courier draft. Corrections refresh the delivery draft before booking submission. Portal corrections do not update courier bookings if already booked elsewhere.',
  courier: 'Portal corrections do not update courier bookings. Update any existing booking separately.',
  outcomes: 'Order Outcomes', replacedBy: 'Replaced by', cancel: 'Cancel Order', reject: 'Reject Submission', replace: 'Replace Order',
  allocated: 'Allocated orders require payment resolution before replacement.', cancelTitle: 'Cancel Order', rejectTitle: 'Reject Order', replaceTitle: 'Replace Order',
  allocationWarning: 'Confirmed payment allocation is preserved and will not be refunded.',
  courierWarning: 'Local cancellation does not cancel the courier booking in Pathao. You must resolve or cancel the booking directly in Pathao.',
  courierUnavailable: 'Courier booking status is unavailable. Check and resolve any Pathao booking directly.',
  draftWarning: 'Cancellation prevents courier draft submission. No local courier attempt is recorded; check Pathao for bookings created elsewhere.',
  cancelReason: 'Reason for cancellation (required)', rejectReason: 'Reason for rejection (required)', replaceReason: 'Replacement reason (required)',
  dismiss: 'Dismiss', cancelling: 'Cancelling…', confirmCancel: 'Confirm Cancellation', rejecting: 'Rejecting…', confirmReject: 'Confirm Rejection', creating: 'Creating…', createReplacement: 'Create Replacement',
  predecessor: 'Predecessor will be cancelled. A new order with fresh link and terms will be created.',
  product: 'Product name', total: 'Total BDT', requiredAdvance: 'Advance BDT', account: 'Active payment account',
  needCancelReason: 'Please provide a cancellation reason.', needRejectReason: 'Please provide a rejection reason.', needReplaceReason: 'Please provide a replacement reason.',
  invalidTotal: 'Total amount must be greater than zero.', invalidAdvance: 'Advance must be positive and not exceed total.', needAccount: 'Select an active payment account.',
  unknownError: 'Outcome unknown. Retry the same request or refresh the order before changing it.',
  failed: 'Request failed. Review the order and try again.', stale: 'The order changed. Refresh it before trying again.', invalidField: 'Check this value and try again.', phoneError: 'Enter a valid Bangladeshi phone number.', amountError: 'Enter a positive amount with up to two decimal places.',
  unauthorized: 'Seller sign-in required.',
} as const;

const bn: Record<keyof typeof en, string> = {
  correctionTitle: 'ক্রেতার তথ্য সংশোধন', loading: 'ক্রেতার তথ্য লোড হচ্ছে…', unavailable: 'সংশোধন এখন সম্ভব নয়। রিফ্রেশ করে আবার চেষ্টা করুন।',
  status: 'অবস্থা:', showDetails: 'পর্যালোচনার তথ্য দেখুন', hideDetails: 'পর্যালোচনার তথ্য লুকান', noReasons: 'পর্যালোচনার কারণ নেই',
  save: 'সংশোধন সংরক্ষণ করে আবার যাচাই করুন', saveDelivery: 'ডেলিভারির তথ্য সংশোধন করুন', saving: 'সংরক্ষণ হচ্ছে…', savingDelivery: 'ডেলিভারির সংশোধন সংরক্ষণ হচ্ছে…', retry: 'একই সংশোধন আবার পাঠান',
  refresh: 'ইনপুট রেখে অর্ডার রিফ্রেশ করুন', refreshed: 'সংরক্ষণের আগে রিফ্রেশ করা অর্ডারের সঙ্গে আপনার ইনপুট মিলিয়ে দেখুন।',
  buyerName: 'ক্রেতার নাম', contact: 'যোগাযোগের নাম্বার', address: 'ডেলিভারির ঠিকানা', claim: 'পেমেন্টের দাবি', provider: 'পেমেন্ট প্রদানকারী', transaction: 'লেনদেনের আইডি', sender: 'পেমেন্ট পাঠানোর নাম্বার', advance: 'দাবি করা অগ্রিম (টাকা)', reason: 'সংশোধনের কারণ',
  locked: 'নিশ্চিত করা অর্ডারে পেমেন্টের শর্ত ও গৃহীত অগ্রিম পরিবর্তন করা যায় না। বিক্রেতার নিশ্চিতকরণ মানে পেমেন্ট প্রদানকারী স্বাধীনভাবে যাচাই করেছে এমন নয়।',
  history: 'ক্রেতার তথ্যের পরিবর্তনের ইতিহাস', revision: 'পরিবর্তন', initial: 'প্রথম জমা', accepted: 'পেমেন্টের দাবি গৃহীত হয়েছে:',
  city: 'শহর নির্ধারিত নয়', zone: 'জোন নির্ধারিত নয়', area: 'এলাকা নির্ধারিত নয়', bookingBlocked: 'বুকিং বন্ধ; বিক্রেতার সমাধান ও পর্যালোচনা প্রয়োজন।',
  booked: 'পাঠাও-এ কুরিয়ার বুকিং নিশ্চিত হয়েছে। এখানে সংশোধন করলে বুকিং বদলায় না। পাঠাও-এ আলাদাভাবে আপডেট করুন।',
  submitting: 'কুরিয়ারে পাঠানো হচ্ছে। এখানে সংশোধন করলে বুকিং বদলায় না। বুকিং হয়ে থাকলে পাঠাও-এ দেখুন।',
  unknownBooking: 'কুরিয়ারে পাঠানোর ফল জানা যায়নি। চেষ্টা মিলিয়ে দেখুন এবং পাঠাও-এ বুকিং থাকলে সমাধান করুন।',
  unsubmitted: 'কুরিয়ার অনুরোধের খসড়া জমা হয়নি। জমার আগে সংশোধনে খসড়া আপডেট হবে। অন্য কোথাও বুকিং হয়েছে কি না দেখুন।',
  courier: 'এখানে সংশোধন করলে কুরিয়ার বুকিং বদলায় না। বিদ্যমান বুকিং আলাদাভাবে আপডেট করুন।',
  outcomes: 'অর্ডারের সিদ্ধান্ত', replacedBy: 'বদলে তৈরি অর্ডার', cancel: 'অর্ডার বাতিল করুন', reject: 'জমা প্রত্যাখ্যান করুন', replace: 'বদলে নতুন অর্ডার করুন',
  allocated: 'পেমেন্ট বরাদ্দ করা অর্ডার বদলানোর আগে পেমেন্টের বিষয়টি সমাধান করুন।', cancelTitle: 'অর্ডার বাতিল', rejectTitle: 'অর্ডার প্রত্যাখ্যান', replaceTitle: 'অর্ডার বদল',
  allocationWarning: 'নিশ্চিত করা পেমেন্টের বরাদ্দ অক্ষত থাকবে; স্বয়ংক্রিয়ভাবে টাকা ফেরত যাবে না।',
  courierWarning: 'এখানে বাতিল করলে পাঠাও-এর কুরিয়ার বুকিং বাতিল হয় না। পাঠাও-এ সরাসরি সমাধান বা বাতিল করুন।',
  courierUnavailable: 'কুরিয়ার বুকিংয়ের অবস্থা জানা যায়নি। পাঠাও-এ বুকিং থাকলে সরাসরি যাচাই ও সমাধান করুন।',
  draftWarning: 'বাতিল করলে কুরিয়ার অনুরোধের খসড়া জমা হবে না। অন্য কোথাও বুকিং হয়েছে কি না পাঠাও-এ দেখুন।',
  cancelReason: 'বাতিলের কারণ (আবশ্যক)', rejectReason: 'প্রত্যাখ্যানের কারণ (আবশ্যক)', replaceReason: 'বদলানোর কারণ (আবশ্যক)',
  dismiss: 'বন্ধ করুন', cancelling: 'বাতিল হচ্ছে…', confirmCancel: 'বাতিল নিশ্চিত করুন', rejecting: 'প্রত্যাখ্যান হচ্ছে…', confirmReject: 'প্রত্যাখ্যান নিশ্চিত করুন', creating: 'তৈরি হচ্ছে…', createReplacement: 'বদলে নতুন অর্ডার তৈরি করুন',
  predecessor: 'আগের অর্ডার বাতিল হবে। নতুন লিংক ও শর্তসহ নতুন অর্ডার তৈরি হবে।',
  product: 'পণ্যের নাম', total: 'মোট টাকা', requiredAdvance: 'ডেলিভারির আগে অগ্রিম (BDT)', account: 'সক্রিয় পেমেন্ট অ্যাকাউন্ট',
  needCancelReason: 'বাতিলের কারণ লিখুন।', needRejectReason: 'প্রত্যাখ্যানের কারণ লিখুন।', needReplaceReason: 'বদলানোর কারণ লিখুন।',
  invalidTotal: 'মোট টাকা শূন্যের বেশি হতে হবে।', invalidAdvance: 'অগ্রিম শূন্যের বেশি এবং মোট টাকার সমান বা কম হতে হবে।', needAccount: 'একটি সক্রিয় পেমেন্ট অ্যাকাউন্ট বাছুন।',
  unknownError: 'ফল জানা যায়নি। একই অনুরোধ আবার পাঠান অথবা পরিবর্তনের আগে অর্ডার রিফ্রেশ করুন।',
  failed: 'অনুরোধ ব্যর্থ হয়েছে। অর্ডার পর্যালোচনা করে আবার চেষ্টা করুন।', stale: 'অর্ডারের তথ্য বদলেছে। আবার চেষ্টা করার আগে রিফ্রেশ করুন।', invalidField: 'এই তথ্য ঠিক করে আবার চেষ্টা করুন।', phoneError: 'বাংলাদেশের একটি বৈধ ফোন নাম্বার লিখুন।', amountError: 'শূন্যের বেশি টাকা লিখুন; দশমিকের পরে সর্বোচ্চ দুই ঘর।',
  unauthorized: 'বিক্রেতা হিসেবে সাইন ইন করুন।',
};

export const correctionOutcomeCopy = { en, bn };
export function correctionStatus(code: string, locale: Locale): string { return lifecycleLabel(code, orderCopy[locale]); }
export function correctionReview(code: string, locale: Locale): string { return reviewLabel(code, orderCopy[locale]); }
const pathaoConditions = {
  en: { resolved: 'Resolved', missing_choices: 'Choices missing', disconnected: 'Location changed', unavailable: 'Unavailable', unsupported: 'Unsupported', no_area_unverified: 'Area not verified' },
  bn: { resolved: 'নির্ধারিত', missing_choices: 'এলাকার তথ্য অসম্পূর্ণ', disconnected: 'এলাকা বদলেছে', unavailable: 'পাওয়া যাচ্ছে না', unsupported: 'ডেলিভারি নেই', no_area_unverified: 'এলাকা যাচাই হয়নি' },
};
export function correctionLocationCondition(code: keyof typeof pathaoConditions.en, locale: Locale): string {
  return pathaoConditions[locale][code];
}
const pathaoEnvironments = {
  en: { offline: 'Offline demonstration', sandbox: 'Sandbox', production: 'Production' },
  bn: { offline: 'অফলাইন নমুনা', sandbox: 'পরীক্ষার পরিবেশ', production: 'চালু পরিবেশ' },
};
export function correctionLocationEnvironment(code: keyof typeof pathaoEnvironments.en, locale: Locale): string {
  return pathaoEnvironments[locale][code];
}
const correctionFields = {
  buyer_name: 'buyerName', contact_number: 'contact', address: 'address', 'address.raw_text': 'address',
  payment_claim: 'claim', 'payment_claim.provider': 'provider', 'payment_claim.trx_id': 'transaction',
  'payment_claim.sender_number': 'sender', 'payment_claim.amount_minor': 'advance', reason: 'reason',
} as const;
export function correctionFieldLabel(field: string, locale: Locale): string | null {
  const key = correctionFields[field as keyof typeof correctionFields];
  return key ? correctionOutcomeCopy[locale][key] : null;
}
export function outcomeFieldError(field: string, action: 'cancel' | 'reject' | 'replace'): 'invalidTotal' | 'invalidAdvance' | 'needAccount' | 'needCancelReason' | 'needRejectReason' | 'needReplaceReason' | null {
  if (field === 'order.total_minor' || field === 'total_minor') return 'invalidTotal';
  if (field === 'order.required_advance_minor' || field === 'required_advance_minor') return 'invalidAdvance';
  if (field === 'order.payment_account_id' || field === 'payment_account_id') return 'needAccount';
  if (field === 'reason') return action === 'cancel' ? 'needCancelReason' : action === 'reject' ? 'needRejectReason' : 'needReplaceReason';
  return null;
}
