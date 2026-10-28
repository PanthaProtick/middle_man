import { keyedCopy } from './keyedCopy';
import type { Locale } from './storage';

const reasons: Record<string, [string, string]> = {
  AMOUNT_MISMATCH: ['Amount does not match', 'টাকার পরিমাণ মেলেনি'],
  SENDER_MISMATCH: ['Sender does not match or is missing', 'প্রেরকের নম্বর মেলেনি বা দেওয়া নেই'],
  TIME_UNCLEAR: ['Payment time is unclear', 'পেমেন্টের সময় নিশ্চিত নয়'],
  WRONG_RECEIVING_ACCOUNT: ['Receiving account does not match', 'প্রাপক অ্যাকাউন্ট মেলেনি'],
  PROVIDER_MISMATCH: ['Payment provider does not match', 'পেমেন্ট সেবাদাতা মেলেনি'],
  PAYMENT_USED: ['Payment has already been used', 'পেমেন্টটি আগেই ব্যবহার করা হয়েছে'],
  COMPETING_CLAIMS: ['Other claims need resolution', 'অন্য দাবিগুলোর সিদ্ধান্ত প্রয়োজন'],
  CONFLICTING_RECEIPTS: ['Received evidence conflicts', 'প্রাপ্ত তথ্যের মধ্যে বিরোধ আছে'],
  TRANSACTION_ID_MISMATCH: ['TrxID does not match', 'TrxID মেলেনি'],
  PAYMENT_EXCEEDS_TOTAL: ['Payment exceeds the order total', 'পেমেন্ট অর্ডারের মোট টাকার বেশি'],
};
/** Exposed for the centralized copy audit; runtime lookups go through paymentReason. */
export const paymentExceptionReasons = reasons;
const reasonText = {
  en: Object.fromEntries(Object.entries(reasons).map(([code, [english]]) => [code, english])),
  bn: Object.fromEntries(Object.entries(reasons).map(([code, [, bengali]]) => [code, bengali])),
};
export function paymentReason(code: string, locale: Locale): string {
  return keyedCopy(locale, reasonText, code, locale === 'bn'
    ? 'অজানা কারণ; তথ্য যাচাই করে সহায়তা নিন' : 'Unknown reason; review the evidence and contact support');
}
export const paymentExceptionCopy = {
  en: {title:'Accept payment exception', intro:'This records your acceptance of the payment; it is not independent provider verification.', receipt:'Existing seller receipt', select:'Select a receipt', more:'Load more receipts', loading:'Loading payment…', refresh:'Refresh payment preview', total:'Order total', advance:'Required advance', hide:'Hide technical IDs', show:'Show technical IDs (for dev)', caption:'Payment claim compared with seller receipt', field:'Field', claim:'Order / buyer claim', seller:'Seller receipt', provider:'Provider', account:'Receiving account ID', sender:'Sender', amount:'Amount', time:'Time', to:'to', unknown:'Unknown', exceptions:'Exceptions to accept', none:'None', blocked:'Cannot accept', resolve:'Resolve evidence or handle externally; receipts cannot be split.', cod:'Remaining COD after acceptance', reason:'Decision reason', retry:'Retry same approval', accept:'Accept full receipt and confirm', unavailable:'Payment information is unavailable. Check your connection and try again.', stale:'Payment information changed. Refresh the preview before trying again.', unauthorized:'Seller sign-in required'},
  bn: {title:'পেমেন্টের ব্যতিক্রম গ্রহণ করুন', intro:'এতে আপনার পেমেন্ট গ্রহণের সিদ্ধান্ত রেকর্ড হবে; সেবাদাতার স্বাধীন যাচাই হবে না।', receipt:'বিক্রেতার রেকর্ড করা পেমেন্ট', select:'একটি রেকর্ড বেছে নিন', more:'আরও পেমেন্ট রেকর্ড দেখুন', loading:'পেমেন্টের তথ্য আনা হচ্ছে…', refresh:'পেমেন্টের তুলনা আবার দেখুন', total:'অর্ডারের মোট টাকা', advance:'ডেলিভারির আগে প্রয়োজনীয় অগ্রিম', hide:'কারিগরি আইডি লুকান', show:'কারিগরি আইডি দেখুন', caption:'ক্রেতার দেওয়া পেমেন্টের তথ্য ও বিক্রেতার রেকর্ডের তুলনা', field:'তথ্য', claim:'অর্ডার / ক্রেতার তথ্য', seller:'বিক্রেতার রেকর্ড', provider:'পেমেন্ট সেবাদাতা', account:'প্রাপক অ্যাকাউন্ট আইডি', sender:'প্রেরক', amount:'টাকার পরিমাণ', time:'সময়', to:'থেকে', unknown:'অজানা', exceptions:'গ্রহণের ব্যতিক্রম', none:'নেই', blocked:'গ্রহণ করা যাচ্ছে না', resolve:'তথ্যের বিরোধ মেটান বা বাইরে সমাধান করুন; পেমেন্ট রেকর্ড ভাগ করা যায় না।', cod:'গ্রহণের পর ডেলিভারির সময় বাকি পরিশোধ', reason:'সিদ্ধান্তের কারণ', retry:'একই সিদ্ধান্ত আবার পাঠান', accept:'সম্পূর্ণ পেমেন্ট গ্রহণ করে নিশ্চিত করুন', unavailable:'পেমেন্টের তথ্য পাওয়া যাচ্ছে না। সংযোগ দেখে আবার চেষ্টা করুন।', stale:'পেমেন্টের তথ্য পরিবর্তিত হয়েছে। আবার চেষ্টা করার আগে তুলনা হালনাগাদ করুন।', unauthorized:'বিক্রেতাকে সাইন ইন করতে হবে'},
} as const;
