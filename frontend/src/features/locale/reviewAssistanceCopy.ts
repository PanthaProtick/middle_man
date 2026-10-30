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
    factsTitle: 'Review details',
    conditions: {
      NO_RECORDED_RECEIPT:
        'No matching seller transaction record was found for this payment claim. This does not mean the buyer did not pay; the payment receipt may not have been imported or recorded yet.',
      UNKNOWN_CAUSE:
        'This order is pending review for an unknown reason. No specific review reason code or missing receipt condition was detected.',
      UNSUPPORTED_REASON_CODE:
        'This order has pending review reasons that require manual verification. Specific automated review assistance for these reasons is not available yet.',
      SENDER_MISMATCH:
        'The sender number on the recorded payment is missing or different from the sender number the buyer submitted.',
      AMOUNT_MISMATCH:
        'The required advance, the buyer claimed amount, and the recorded payment amount do not all match.',
      TIME_UNCLEAR:
        'The recorded payment time is missing or outside the period between order creation and claim submission.',
      WRONG_RECEIVING_ACCOUNT:
        'The recorded payment was received into a different payment account than the one on this order.',
      CONFLICTING_RECEIPTS:
        'Conflicting receipts were recorded for the same transaction ID and require manual verification.',
      COMPETING_CLAIMS:
        'More than one active claim in this shop uses the same payment transaction, or an earlier review held this claim.',
      PAYMENT_USED:
        'The recorded payment is already used or allocated to another order.',
      MULTIPLE_REVIEW_REASONS:
        'This submission has several review reasons. Review the details below before deciding.',
    },
    actions: {
      CHECK_TRANSACTIONS: 'Check transactions',
      CORRECT_BUYER_DETAILS: 'Correct buyer details',
    },
    facts: {
      requiredAdvance: 'Required advance',
      claimedAmount: 'Buyer claimed',
      receivedAmount: 'Recorded payment',
      sender: 'Sender',
      senderMissing: 'No sender number recorded',
      senderDifferent: 'Different from the claimed sender',
      paymentTime: 'Payment time',
      timeMissing: 'No payment time recorded',
      timeBefore: 'Before the order was created',
      timeAfter: 'After the claim was submitted',
      receivingAccount: 'Receiving account',
      receivingAccountDifferent: 'Different from the order account',
      conflictCategories: 'Conflicting details',
      activeClaimCount: 'Active competing claims',
      heldByPriorResolution: 'Held by an earlier review',
      paymentUsed: 'Payment already used',
      paymentAllocated: 'Payment already allocated',
      yes: 'Yes',
      no: 'No',
      conflictCategoryLabels: {
        amount: 'amount',
        receiving_account: 'receiving account',
        sender: 'sender',
        time: 'time',
      },
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
    factsTitle: 'পর্যালোচনার বিবরণ',
    conditions: {
      NO_RECORDED_RECEIPT:
        'এই পেমেন্ট দাবির সাথে মিল থাকা কোনো বিক্রেতা লেনদেন রেকর্ড পাওয়া যায়নি। এর মানে এই নয় যে ক্রেতা অর্থ প্রদান করেননি; পেমেন্ট রসিদটি এখনও আমদানি বা রেকর্ড করা নাও হতে পারে।',
      UNKNOWN_CAUSE:
        'এই অর্ডারটি একটি অজানা কারণে পর্যালোচনার জন্য অপেক্ষমাণ রয়েছে। কোনো সুনির্দিষ্ট পর্যালোচনা কারণ কোড বা অনুপস্থিত রসিদ শনাক্ত করা যায়নি।',
      UNSUPPORTED_REASON_CODE:
        'এই অর্ডারে পর্যালোচনার জন্য অপেক্ষমাণ কারণ রয়েছে যা ম্যানুয়ালি যাচাই করা প্রয়োজন। এই কারণগুলির জন্য নির্দিষ্ট স্বয়ংক্রিয় সহায়তা এখনও উপলব্ধ নেই।',
      SENDER_MISMATCH:
        'রেকর্ড করা পেমেন্টে প্রেরকের নম্বর নেই অথবা ক্রেতা যে নম্বর জমা দিয়েছেন তার থেকে আলাদা।',
      AMOUNT_MISMATCH:
        'প্রয়োজনীয় অগ্রিম, ক্রেতার দাবি করা পরিমাণ এবং রেকর্ড করা পেমেন্টের পরিমাণ সব একসাথে মিলছে না।',
      TIME_UNCLEAR:
        'রেকর্ড করা পেমেন্টের সময় নেই অথবা অর্ডার তৈরির ও দাবি জমার মধ্যবর্তী সময়ের বাইরে।',
      WRONG_RECEIVING_ACCOUNT:
        'রেকর্ড করা পেমেন্ট এই অর্ডারের অ্যাকাউন্টের পরিবর্তে অন্য একটি পেমেন্ট অ্যাকাউন্টে গৃহীত হয়েছে।',
      CONFLICTING_RECEIPTS:
        'একই লেনদেন আইডির জন্য পরস্পরবিরোধী রসিদ রেকর্ড করা হয়েছে এবং ম্যানুয়ালি যাচাই প্রয়োজন।',
      COMPETING_CLAIMS:
        'এই দোকানে একাধিক সক্রিয় দাবি একই পেমেন্ট লেনদেন ব্যবহার করছে, অথবা আগের একটি পর্যালোচনা এই দাবিটি ধরে রেখেছে।',
      PAYMENT_USED:
        'রেকর্ড করা পেমেন্টটি ইতিমধ্যে ব্যবহৃত অথবা অন্য একটি অর্ডারে বরাদ্দ করা হয়েছে।',
      MULTIPLE_REVIEW_REASONS:
        'এই জমাদানে একাধিক পর্যালোচনা কারণ রয়েছে। সিদ্ধান্তের আগে নিচের বিবরণ দেখুন।',
    },
    actions: {
      CHECK_TRANSACTIONS: 'লেনদেন পরীক্ষা করুন',
      CORRECT_BUYER_DETAILS: 'ক্রেতার তথ্য সংশোধন করুন',
    },
    facts: {
      requiredAdvance: 'প্রয়োজনীয় অগ্রিম',
      claimedAmount: 'ক্রেতার দাবি',
      receivedAmount: 'রেকর্ড করা পেমেন্ট',
      sender: 'প্রেরক',
      senderMissing: 'কোনো প্রেরকের নম্বর রেকর্ড করা নেই',
      senderDifferent: 'দাবি করা প্রেরকের থেকে আলাদা',
      paymentTime: 'পেমেন্টের সময়',
      timeMissing: 'কোনো পেমেন্টের সময় রেকর্ড করা নেই',
      timeBefore: 'অর্ডার তৈরির আগে',
      timeAfter: 'দাবি জমা দেওয়ার পরে',
      receivingAccount: 'গ্রহণকারী অ্যাকাউন্ট',
      receivingAccountDifferent: 'অর্ডারের অ্যাকাউন্টের থেকে আলাদা',
      conflictCategories: 'বিরোধপূর্ণ তথ্য',
      activeClaimCount: 'সক্রিয় প্রতিদ্বন্দ্বী দাবি',
      heldByPriorResolution: 'আগের পর্যালোচনায় ধরে রাখা',
      paymentUsed: 'পেমেন্ট ইতিমধ্যে ব্যবহৃত',
      paymentAllocated: 'পেমেন্ট ইতিমধ্যে বরাদ্দকৃত',
      yes: 'হ্যাঁ',
      no: 'না',
      conflictCategoryLabels: {
        amount: 'পরিমাণ',
        receiving_account: 'গ্রহণকারী অ্যাকাউন্ট',
        sender: 'প্রেরক',
        time: 'সময়',
      },
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
