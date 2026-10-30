import type { Locale } from './storage';

export const reviewAssistanceCopy = {
  en: {
    askAi: 'Ask AI',
    askAiAria: 'Ask AI for explanation and suggested actions',
    localBadge: 'Local guidance',
    advisoryNote: 'Local explanation is an advisory aid, not an independent verification result.',
    loading: 'Getting guidance…',
    error: 'Unable to load review assistance.',
    retry: 'Try again',
    close: 'Close guidance',
    suggestedActions: 'Suggested actions',
    conditions: {
      NO_RECORDED_RECEIPT:
        'No matching seller transaction record was found for this payment claim. This does not mean the buyer did not pay; the payment receipt may not have been imported or recorded yet.',
      UNKNOWN_CAUSE:
        'This order is pending review for an unknown reason. No specific review reason code or missing receipt condition was detected.',
      UNSUPPORTED_REASON_CODE:
        'This order has pending review reasons that require manual verification. Specific automated review assistance for these reasons is not available yet.',
    },
    actions: {
      CHECK_TRANSACTIONS: 'Check transactions',
      CORRECT_BUYER_DETAILS: 'Correct buyer details',
    },
  },
  bn: {
    askAi: 'এআই সাহায্য',
    askAiAria: 'ব্যাখ্যা ও পরবর্তী পদক্ষেপের জন্য এআই সাহায্য চান',
    localBadge: 'স্থানীয় নির্দেশনা',
    advisoryNote: 'স্থানীয় ব্যাখ্যা একটি পরামর্শমূলক সহায়তা, স্বাধীন যাচাইকরণ ফলাফল নয়।',
    loading: 'নির্দেশনা আনা হচ্ছে…',
    error: 'পর্যালোচনা সহায়তা লোড করা যায়নি।',
    retry: 'আবার চেষ্টা করুন',
    close: 'নির্দেশনা বন্ধ করুন',
    suggestedActions: 'প্রস্তাবিত পদক্ষেপ',
    conditions: {
      NO_RECORDED_RECEIPT:
        'এই পেমেন্ট দাবির সাথে মিল থাকা কোনো বিক্রেতা লেনদেন রেকর্ড পাওয়া যায়নি। এর মানে এই নয় যে ক্রেতা অর্থ প্রদান করেননি; পেমেন্ট রসিদটি এখনও আমদানি বা রেকর্ড করা নাও হতে পারে।',
      UNKNOWN_CAUSE:
        'এই অর্ডারটি একটি অজানা কারণে পর্যালোচনার জন্য অপেক্ষমাণ রয়েছে। কোনো সুনির্দিষ্ট পর্যালোচনা কারণ কোড বা অনুপস্থিত রসিদ শনাক্ত করা যায়নি।',
      UNSUPPORTED_REASON_CODE:
        'এই অর্ডারে পর্যালোচনার জন্য অপেক্ষমাণ কারণ রয়েছে যা ম্যানুয়ালি যাচাই করা প্রয়োজন। এই কারণগুলির জন্য নির্দিষ্ট স্বয়ংক্রিয় সহায়তা এখনও উপলব্ধ নেই।',
    },
    actions: {
      CHECK_TRANSACTIONS: 'লেনদেন পরীক্ষা করুন',
      CORRECT_BUYER_DETAILS: 'ক্রেতার তথ্য সংশোধন করুন',
    },
  },
} as const;

export function getConditionExplanation(condition: string, locale: Locale, fallback?: string): string {
  const dict = reviewAssistanceCopy[locale].conditions as Record<string, string>;
  return dict[condition] || fallback || '';
}

export function getActionLabel(actionId: string, locale: Locale, fallback?: string): string {
  const dict = reviewAssistanceCopy[locale].actions as Record<string, string>;
  return dict[actionId] || fallback || actionId;
}
