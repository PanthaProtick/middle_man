import { formatCount } from './format';
import { keyedCopy } from './keyedCopy';
import type { Locale } from './storage';
import { SellerApiError } from '../seller/api';

const bn: Record<string, string> = {
  'Accepted payment history':'গৃহীত পেমেন্টের ইতিহাস',
  'Loading decision history…':'সিদ্ধান্তের ইতিহাস আনা হচ্ছে…',
  'Payment history unavailable':'পেমেন্টের ইতিহাস পাওয়া যাচ্ছে না। আবার চেষ্টা করুন।',
  'Retry history':'ইতিহাস আবার আনুন', 'Accepted advance':'গৃহীত ডেলিভারির আগে অগ্রিম',
  'Remaining COD':'ডেলিভারির সময় বাকি পরিশোধ', 'Accepted exceptions':'গৃহীত ব্যতিক্রম',
  'None':'নেই', 'Reason':'কারণ', 'Seller':'বিক্রেতা', 'Shop totals':'দোকানের মোট হিসাব',
  'confirmed':'নিশ্চিত', 'manual acceptances':'হাতে গ্রহণ', 'accepted exception orders':'ব্যতিক্রম গ্রহণ করা অর্ডার',
  'No accepted payment decisions yet.':'এখনও কোনো পেমেন্ট গ্রহণের সিদ্ধান্ত নেই।',
  'Seller sign-in required':'বিক্রেতাকে সাইন ইন করতে হবে',
  'Access denied. Sign in with the owning shop.':'প্রবেশের অনুমতি নেই। সংশ্লিষ্ট দোকানের অ্যাকাউন্টে সাইন ইন করুন।',
  'Record unavailable. Refresh the workspace.':'রেকর্ড পাওয়া যাচ্ছে না। কাজের তালিকা হালনাগাদ করুন।',
  'Retention unavailable. Please retry.':'সংরক্ষণের তথ্য পাওয়া যাচ্ছে না। আবার চেষ্টা করুন।',
  'Failed to load retention status':'সংরক্ষণের তথ্য আনা যায়নি। আবার চেষ্টা করুন।',
  'Failed to execute raw evidence cleanup':'মূল তথ্য মুছে ফেলা যায়নি। আবার চেষ্টা করুন।',
  'Loading evidence retention status…':'মূল তথ্য সংরক্ষণের অবস্থা আনা হচ্ছে…',
  'Raw evidence retention and cleanup':'মূল তথ্য সংরক্ষণ ও মুছে ফেলা',
  '30-Day Raw Evidence Retention':'মূল তথ্য 30 দিন সংরক্ষণ',
  'Original raw SMS text and address AI requests/responses are retained for up to 30 days from collection. Reprocessing never resets this deadline. Structured claims, accepted allocations, and COD remain intact after deletion.':'মূল SMS ও ঠিকানা সংক্রান্ত AI অনুরোধ ও উত্তর সংগ্রহের পর সর্বোচ্চ 30 দিন রাখা হয়। আবার প্রক্রিয়া করলে এই সময়সীমা বাড়ে না। মুছে ফেলার পরও দাবির তথ্য, গৃহীত বরাদ্দ ও বাকি পরিশোধের হিসাব অক্ষত থাকে।',
  'Refresh retention status':'সংরক্ষণের অবস্থা হালনাগাদ করুন', 'Refresh':'হালনাগাদ করুন',
  'Run Evidence Cleanup':'মূল তথ্য মুছে ফেলুন', 'Running cleanup…':'মুছে ফেলা হচ্ছে…',
  'Raw SMS':'মূল SMS', 'AI Prompts/Outputs':'AI অনুরোধ ও উত্তর', 'retained':'সংরক্ষিত', 'purged':'মুছে ফেলা হয়েছে',
  'raw evidence items overdue':'টি মূল তথ্য মুছে ফেলার সময় পেরিয়েছে', 'storage failure':'টি সংরক্ষণ ব্যবস্থার ব্যর্থতা',
  'Raw evidence clean':'মূল তথ্য মুছে ফেলার কাজ সম্পন্ন', '(0 overdue)':'(0টির সময় পেরিয়েছে)',
  'Last checked':'শেষ যাচাই', 'Pending Deletions':'মুছে ফেলার অপেক্ষায়', 'Deadline':'সময়সীমা',
  'sms':'SMS', 'address_ai':'ঠিকানার AI তথ্য',
  'Cleanup overdue. Retry cleanup; contact support if it continues.':'মুছে ফেলার সময় পেরিয়েছে। আবার মুছে ফেলার চেষ্টা করুন; সমস্যা থাকলে সহায়তা নিন।',
  'Unknown evidence type; review the record.':'তথ্যের ধরন অজানা; রেকর্ড যাচাই করুন।',
  'Completed record retention':'সম্পন্ন রেকর্ড সংরক্ষণ',
  'Completed personal records are removed after 12 calendar months. Unresolved orders stay available. Used payments remain protected.':'সম্পন্ন ব্যক্তিগত রেকর্ড 12 ক্যালেন্ডার মাস পর মুছে ফেলা হয়। অমীমাংসিত অর্ডার রাখা হয়। ব্যবহৃত পেমেন্ট সুরক্ষিত থাকে।',
  'Loading retention status…':'সংরক্ষণের অবস্থা আনা হচ্ছে…', 'overdue':'সময় পেরিয়েছে', 'failed':'ব্যর্থ',
  'Offline demonstration':'অফলাইন প্রদর্শন', 'Removed':'মুছে ফেলা হয়েছে', 'completed records.':'টি সম্পন্ন রেকর্ড।',
  'Run / retry completed record cleanup':'সম্পন্ন রেকর্ড মুছুন / আবার চেষ্টা করুন', 'Retry retention status':'সংরক্ষণের অবস্থা আবার আনুন',
  'Data retention policy':'তথ্য সংরক্ষণের নীতি',
  'Inspect and run cleanup for raw evidence and completed records.':'মূল তথ্য ও সম্পন্ন রেকর্ড সংরক্ষণের অবস্থা দেখুন এবং মুছে ফেলুন।',
};
/** Exposed for the centralized copy audit; runtime lookups go through historyText. */
export const historyBengali = bn;
const historyCopy = { en: {}, bn };
export const historyText = (locale: Locale, text: string): string => keyedCopy(locale, historyCopy, text);

/** Retain a stable presentation key, never server text that may contain private data. */
export function historyError(error: unknown, fallback: string): string {
  if (!(error instanceof SellerApiError)) return fallback;
  const messages: Record<string, string> = {
    UNAUTHORIZED:'Seller sign-in required', FORBIDDEN:'Access denied. Sign in with the owning shop.',
    NOT_FOUND:'Record unavailable. Refresh the workspace.', RECORD_UNAVAILABLE:'Record unavailable. Refresh the workspace.',
    RETENTION_UNAVAILABLE:'Retention unavailable. Please retry.',
  };
  return messages[error.code] ?? fallback;
}

export function cleanupFeedback(locale: Locale, purged: number, failed: number, remaining: number): string {
  return locale === 'bn' ? `${formatCount(purged)}টি মূল তথ্য মুছে ফেলা হয়েছে (${formatCount(failed)}টি ব্যর্থ, ${formatCount(remaining)}টির সময় পেরিয়েছে)।`
    : `Purged ${formatCount(purged)} raw items (${formatCount(failed)} failed, ${formatCount(remaining)} overdue remaining).`;
}
