const en = {
  open: 'Open Portal', access: 'Buyer link access', unchanged: 'These actions keep the order and payment unchanged.',
  revoked: 'Buyer link revoked. Seller access remains available.',
  stale: 'Order changed. Close and reopen its details before changing access.',
  revokeUnconfirmed: 'Revocation is unconfirmed. Retry to resolve the outcome.',
  reissueUnconfirmed: 'Reissue is unconfirmed. Retry to resolve the outcome.',
  revokeDescription: 'Block buyer access to the current link.',
  reissueDescription: 'Create a new link and permanently disable previous links. The deadline and submission state stay unchanged.',
  revoking: 'Revoking…', retryRevoke: 'Retry revocation', revoke: 'Revoke buyer link',
  reissuing: 'Reissuing…', retryReissue: 'Retry reissue', reissue: 'Reissue buyer link',
  copyTitle: 'Copy buyer link to clipboard', copiedDetail: 'Copied Buyer Link', copied: 'Copied!',
  copying: 'Copying…', copyDetail: 'Copy Buyer Link', copy: 'Copy Link',
  copyFailed: 'Could not copy the buyer link. Select and copy it below, or retry.', manual: 'Buyer link to copy manually',
} as const;
const bn: Record<keyof typeof en, string> = {
  open: 'ক্রেতার পাতা খুলুন', access: 'ক্রেতার লিংকের প্রবেশাধিকার', unchanged: 'এই কাজগুলোতে অর্ডার ও পেমেন্ট অপরিবর্তিত থাকবে।',
  revoked: 'ক্রেতার লিংক বন্ধ করা হয়েছে। বিক্রেতার প্রবেশাধিকার থাকবে।',
  stale: 'অর্ডার পরিবর্তিত হয়েছে। প্রবেশাধিকার বদলানোর আগে বিস্তারিত বন্ধ করে আবার খুলুন।',
  revokeUnconfirmed: 'লিংক বন্ধ হয়েছে কি না নিশ্চিত নয়। ফলাফল জানতে আবার চেষ্টা করুন।',
  reissueUnconfirmed: 'নতুন লিংক তৈরি হয়েছে কি না নিশ্চিত নয়। ফলাফল জানতে আবার চেষ্টা করুন।',
  revokeDescription: 'বর্তমান লিংকে ক্রেতার প্রবেশ বন্ধ করুন।',
  reissueDescription: 'নতুন লিংক তৈরি করে আগের সব লিংক স্থায়ীভাবে বন্ধ করুন। সময়সীমা ও জমা দেওয়ার অবস্থা অপরিবর্তিত থাকবে।',
  revoking: 'বন্ধ করা হচ্ছে…', retryRevoke: 'লিংক বন্ধ করতে আবার চেষ্টা করুন', revoke: 'ক্রেতার লিংক বন্ধ করুন',
  reissuing: 'নতুন লিংক তৈরি হচ্ছে…', retryReissue: 'নতুন লিংকের জন্য আবার চেষ্টা করুন', reissue: 'নতুন ক্রেতার লিংক তৈরি করুন',
  copyTitle: 'ক্রেতার লিংক কপি করুন', copiedDetail: 'ক্রেতার লিংক কপি হয়েছে', copied: 'কপি হয়েছে!',
  copying: 'কপি হচ্ছে…', copyDetail: 'ক্রেতার লিংক কপি করুন', copy: 'লিংক কপি করুন',
  copyFailed: 'ক্রেতার লিংক কপি করা যায়নি। নিচের লিংকটি নির্বাচন করে কপি করুন অথবা আবার চেষ্টা করুন।', manual: 'নিজে কপি করার জন্য ক্রেতার লিংক',
};
export const buyerLinkCopy = { en, bn };
