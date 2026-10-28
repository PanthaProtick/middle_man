import { keyedCopy } from './keyedCopy';
import { SellerApiError } from '../seller/api';
import type { Locale } from './storage';
const bn: Record<string, string> = {
  "Invalid Bangladeshi phone number":"সঠিক বাংলাদেশি ফোন নম্বর লিখুন",
  "Unknown status or source; review the original evidence.":"অবস্থা বা উৎস অজানা; মূল তথ্য যাচাই করুন।",
  "used":"ব্যবহৃত", "unmatched":"অমিল", "conflicted":"বিরোধপূর্ণ", "incomplete":"অসম্পূর্ণ", "valid":"সঠিক", "sms_import":"SMS থেকে যোগ করা",
  "Select complete evidence":"সম্পূর্ণ তথ্য বেছে নিন",
  "Refetch current claims":"বর্তমান দাবি আবার আনুন",
  "Access denied":"প্রবেশের অনুমতি নেই",
  "Seller sign-in required":"বিক্রেতাকে সাইন ইন করতে হবে",
  "Refetch evidence":"তথ্য আবার আনুন",
  "Compare and explicitly resolve existing receipt":"বর্তমান পেমেন্ট রেকর্ড তুলনা করে সিদ্ধান্ত নিন",
  "Payment already used":"পেমেন্ট আগেই ব্যবহার করা হয়েছে",
  "pending":"অপেক্ষমাণ", "confirmed":"নিশ্চিত", "cancelled":"বাতিল", "rejected":"প্রত্যাখ্যাত", "manual":"হাতে লেখা", "sms":"SMS", "Before":"আগে", "After":"পরে", "Sender":"প্রেরক", "Account":"অ্যাকাউন্ট", "Observation":"রেকর্ড", "Claim":"দাবি", "Accepted allocation":"গৃহীত বরাদ্দ", "locked":"সুরক্ষিত", "Later evidence cannot change accepted funds.":"পরের তথ্য গৃহীত টাকা পরিবর্তন করতে পারে না।",
  "Evidence resolution": "তথ্যের বিরোধের সিদ্ধান্ত",
  "Retry comparison": "আবার তুলনা করুন",
  "Loading evidence comparison…": "তথ্য তুলনা করা হচ্ছে…",
  "Compare and resolve": "তুলনা করে সিদ্ধান্ত নিন",
  "Select received evidence. Choosing a claim explicitly holds the other current claims; exact matching rules still apply.": "প্রাপ্ত তথ্য বেছে নিন। একটি দাবি বাছলে অন্য বর্তমান দাবিগুলো স্থগিত থাকবে; সঠিক মিলের নিয়ম প্রযোজ্য থাকবে।",
  "Conflicting observations require seller review.": "পরস্পরবিরোধী তথ্য বিক্রেতাকে পর্যালোচনা করতে হবে।",
  "Held by seller decision.": "বিক্রেতার সিদ্ধান্তে স্থগিত।",
  "Resolve evidence": "তথ্যের বিরোধ মেটান",
  "Received observation": "প্রাপ্ত তথ্য",
  " — select complete evidence to continue.": " — এগোতে সম্পূর্ণ তথ্য বেছে নিন।",
  "Select complete observation": "সম্পূর্ণ তথ্য বেছে নিন",
  "Claim decision": "দাবির সিদ্ধান্ত",
  "Resolve observations only; keep competing claims held": "শুধু তথ্যের বিরোধ মেটান; অন্য দাবি স্থগিত রাখুন",
  "Decision reason": "সিদ্ধান্তের কারণ",
  " — a nonblank reason is required.": " — কারণ লিখতে হবে।",
  "Recording…": "রেকর্ড করা হচ্ছে…",
  "Retry same decision": "একই সিদ্ধান্ত আবার পাঠান",
  "Record resolution": "সিদ্ধান্ত রেকর্ড করুন",
  "Refresh comparison": "তুলনা হালনাগাদ করুন",
  "Correction history": "সংশোধনের ইতিহাস",
  "Decision history": "সিদ্ধান্তের ইতিহাস",
  "Unknown sender": "প্রেরক অজানা",
  "Unknown time": "সময় অজানা",
  "no claim selected": "কোনো দাবি বাছা হয়নি",
  "consistent": "সামঞ্জস্যপূর্ণ",
  "Receipt correction": "পেমেন্ট রেকর্ড সংশোধন",
  "Correct unallocated receipt": "বরাদ্দ না হওয়া পেমেন্ট রেকর্ড সংশোধন করুন",
  "Correct receipt": "পেমেন্ট রেকর্ড সংশোধন করুন",
  "Receiving account": "প্রাপক অ্যাকাউন্ট",
  "Correction account": "সংশোধিত অ্যাকাউন্ট",
  "Correction TrxID": "সংশোধিত TrxID",
  "Received amount (BDT)": "প্রাপ্ত টাকার পরিমাণ (BDT)",
  "Correction amount": "সংশোধিত টাকার পরিমাণ",
  "Payment sender (blank if unknown)": "পেমেন্ট প্রেরক (অজানা হলে ফাঁকা রাখুন)",
  "Correction sender": "সংশোধিত প্রেরক",
  "Receipt time (ISO with timezone, blank if unknown)": "পেমেন্টের সময় (সময় অঞ্চলসহ ISO, অজানা হলে ফাঁকা রাখুন)",
  "Correction time": "সংশোধিত সময়",
  "Correction reason — required": "সংশোধনের কারণ — আবশ্যক",
  "Correction reason": "সংশোধনের কারণ",
  "Saving correction…": "সংশোধন সংরক্ষণ করা হচ্ছে…",
  "Retry same correction": "একই সংশোধন আবার পাঠান",
  "Save correction and check claims": "সংশোধন সংরক্ষণ করে দাবি যাচাই করুন",
  "Record Received Payment": "প্রাপ্ত পেমেন্ট রেকর্ড করুন",
  "Close": "বন্ধ করুন",
  "Receiving Account *": "প্রাপক অ্যাকাউন্ট *",
  "No active receiving accounts available": "কোনো সক্রিয় প্রাপক অ্যাকাউন্ট নেই",
  "Transaction ID (TrxID) *": "লেনদেনের আইডি (TrxID) *",
  "e.g. 9K72LKQW1": "যেমন: 9K72LKQW1",
  "Actual Received Amount (BDT) *": "প্রকৃত প্রাপ্ত টাকা (BDT) *",
  "e.g. 150": "যেমন: 150",
  "Sender Number ": "প্রেরকের নম্বর ",
  "e.g. 01700000000": "যেমন: 01700000000",
  "(Optional - incomplete if omitted)": "(ঐচ্ছিক — না দিলে তথ্য অসম্পূর্ণ থাকবে)",
  "Payment Occurrence Time ": "পেমেন্টের সময় ",
  "Cancel": "বাতিল করুন",
  "Recording...": "রেকর্ড করা হচ্ছে...",
  "Record Payment": "পেমেন্ট রেকর্ড করুন",
  "Please select a receiving account": "প্রাপক অ্যাকাউন্ট বেছে নিন",
  "TrxID is required": "TrxID লিখুন",
  "Actual received amount must be greater than 0": "প্রাপ্ত টাকার পরিমাণ শূন্যের বেশি হতে হবে",
  "Invalid amount": "টাকার পরিমাণ সঠিক নয়",
  "Selected receiving account is invalid or inactive": "বাছা প্রাপক অ্যাকাউন্ট সঠিক নয় বা নিষ্ক্রিয়",
  "Enter a valid receipt amount up to BDT 1,000,000,000.": "সঠিক পরিমাণ লিখুন, সর্বোচ্চ BDT 1,000,000,000।",
  "TrxID and correction reason are required.": "TrxID ও সংশোধনের কারণ লিখতে হবে।",
  "Use a valid ISO time with Z or a timezone offset, or leave it unknown.": "Z বা সময় অঞ্চলসহ সঠিক ISO সময় লিখুন, অথবা ফাঁকা রাখুন।",
  "Check corrected fields": "সংশোধিত তথ্য যাচাই করুন",
  "Comparison unavailable": "তুলনার তথ্য পাওয়া যাচ্ছে না। আবার চেষ্টা করুন।",
  "Outcome unknown; retry the same decision": "ফলাফল নিশ্চিত নয়; একই সিদ্ধান্ত আবার পাঠান",
  "Outcome unknown; retry the same correction": "ফলাফল নিশ্চিত নয়; একই সংশোধন আবার পাঠান",
  "Failed to record transaction": "পেমেন্ট রেকর্ড করা যায়নি। তথ্য যাচাই করে আবার চেষ্টা করুন।"
};
/** Exposed for the centralized copy audit; runtime lookups go through receiptText. */
export const receiptBengali = bn;
const receiptCopy = { en: {}, bn };
export const receiptText = (locale: Locale, value: string): string => keyedCopy(locale, receiptCopy, value);

export function receiptError(error: unknown, fallback: string): string {
  if (!(error instanceof SellerApiError)) return fallback;
  const messages: Record<string, string> = {UNAUTHORIZED:'Seller sign-in required', STALE_VERSION:'Refetch evidence', RECEIPT_IDENTITY_COLLISION:'Compare and explicitly resolve existing receipt', PAYMENT_USED:'Payment already used', VALIDATION_ERROR:'Check corrected fields', INVALID_RECEIPT:'Check corrected fields', FORBIDDEN:'Access denied', CLAIM_CHANGED:'Refetch current claims', INCOMPLETE_EVIDENCE:'Select complete evidence', OBSERVATION_IDENTITY_CHANGED:'Refetch evidence'};
  return messages[error.code] ?? fallback;
}

/** Only translate known domain codes; never apply this to free-form evidence. */
export function receiptCode(locale: Locale, code: string): string {
  const known = ["pending", "confirmed", "cancelled", "rejected", "manual", "sms", "sms_import", "used", "unmatched", "conflicted", "incomplete", "valid"];
  return receiptText(locale, known.includes(code) ? code : "Unknown status or source; review the original evidence.");
}
