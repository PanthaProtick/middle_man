import type { ClerkProviderProps } from '@clerk/react';

type ClerkSignInResource = NonNullable<NonNullable<ClerkProviderProps['localization']>['signIn']>;

/** Bengali copy for Clerk's sign-in, verification, and recovery screens. */
export const clerkBengaliSignIn = {
  start: {
    title: 'আপনার দোকানে সাইন ইন করুন',
    titleCombined: 'আপনার দোকানে সাইন ইন করুন',
    subtitle: 'চালিয়ে যেতে আপনার অ্যাকাউন্টে সাইন ইন করুন।',
    subtitleCombined: 'চালিয়ে যেতে আপনার অ্যাকাউন্টে সাইন ইন করুন।',
    actionText: 'অ্যাকাউন্ট নেই?',
    actionLink: 'নিবন্ধন করুন',
    actionLink__use_email: 'ইমেইল ব্যবহার করুন',
    actionLink__use_phone: 'ফোন ব্যবহার করুন',
    actionLink__use_username: 'ব্যবহারকারীর নাম ব্যবহার করুন',
    actionLink__use_email_username: 'ইমেইল বা ব্যবহারকারীর নাম ব্যবহার করুন',
    actionLink__use_passkey: 'পাসকি ব্যবহার করুন',
    actionText__join_waitlist: 'অপেক্ষমাণ তালিকায় যোগ দিতে চান?',
    actionLink__join_waitlist: 'অপেক্ষমাণ তালিকায় যোগ দিন',
    alternativePhoneCodeProvider: {
      actionLink: 'অন্য ফোন কোড পদ্ধতি ব্যবহার করুন',
      label: '{{provider}} দিয়ে চালিয়ে যান',
      subtitle: '{{provider}} দিয়ে একটি যাচাইকরণ কোড পাঠানো হবে।',
      title: '{{provider}} দিয়ে যাচাই করুন',
    },
  },
  password: {
    title: 'আপনার পাসওয়ার্ড লিখুন',
    subtitle: 'আপনার অ্যাকাউন্টে সাইন ইন করতে পাসওয়ার্ড লিখুন।',
    actionLink: 'পাসওয়ার্ড ভুলে গেছেন?',
  },
  passwordCompromised: {
    title: 'এই পাসওয়ার্ডটি অনলাইনে ফাঁস হয়েছে। অন্য পাসওয়ার্ড ব্যবহার করুন।',
  },
  passkey: {
    title: 'পাসকি দিয়ে সাইন ইন করুন',
    subtitle: 'আপনার ডিভাইসে সংরক্ষিত পাসকি ব্যবহার করে চালিয়ে যান।',
  },
  forgotPasswordAlternativeMethods: {
    title: 'পাসওয়ার্ড ভুলে গেছেন?',
    label__alternativeMethods: 'অন্য পদ্ধতি ব্যবহার করুন',
    blockButton__resetPassword: 'পাসওয়ার্ড রিসেট করুন',
  },
  forgotPassword: {
    title: 'পাসওয়ার্ড রিসেট করুন',
    subtitle: 'আমরা আপনাকে একটি যাচাইকরণ কোড পাঠাব।',
    subtitle_email: 'আমরা আপনার ইমেইলে একটি যাচাইকরণ কোড পাঠাব।',
    subtitle_phone: 'আমরা আপনার ফোনে একটি যাচাইকরণ কোড পাঠাব।',
    formTitle: 'পাসওয়ার্ড রিসেট করুন',
    resendButton: 'কোড আবার পাঠান',
  },
  resetPassword: {
    title: 'নতুন পাসওয়ার্ড দিন',
    formButtonPrimary: 'পাসওয়ার্ড রিসেট করুন',
    successMessage: 'আপনার পাসওয়ার্ড রিসেট হয়েছে।',
    requiredMessage: 'চালিয়ে যেতে আপনার পাসওয়ার্ড রিসেট করুন।',
  },
  resetPasswordMfa: {
    detailsLabel: 'পাসওয়ার্ড রিসেট করতে আপনার পরিচয় যাচাই করুন।',
  },
  emailCode: {
    title: 'আপনার ইমেইল যাচাই করুন',
    subtitle: 'আপনার ইমেইলে পাঠানো কোডটি লিখুন।',
    formTitle: 'যাচাইকরণ কোড লিখুন',
    resendButton: 'কোড আবার পাঠান',
  },
  emailLink: {
    title: 'আপনার ইমেইল যাচাই করুন',
    subtitle: 'আপনার ইমেইলে পাঠানো লিংকে ক্লিক করুন।',
    formTitle: 'আপনার ইমেইলে পাঠানো লিংকে ক্লিক করুন',
    formSubtitle: 'লিংকটি কাজ না করলে আবার পাঠান।',
    resendButton: 'লিংক আবার পাঠান',
    unusedTab: {
      title: 'অন্য ট্যাবে যাচাইকরণ সম্পন্ন হয়েছে। আপনি এই ট্যাবটি বন্ধ করতে পারেন।',
    },
    verified: {
      title: 'ইমেইল যাচাই হয়েছে',
      subtitle: 'আপনি এখন চালিয়ে যেতে পারেন।',
    },
    verifiedSwitchTab: {
      subtitle: 'অন্য ট্যাবে চালিয়ে যান।',
      titleNewTab: 'আপনি এখন সাইন ইন করেছেন',
      subtitleNewTab: 'আপনার অ্যাকাউন্ট ব্যবহার করতে এই ট্যাবে ফিরে যান।',
    },
    loading: {
      title: 'যাচাই করা হচ্ছে',
      subtitle: 'অনুগ্রহ করে অপেক্ষা করুন।',
    },
    failed: {
      title: 'যাচাইকরণ ব্যর্থ হয়েছে',
      subtitle: 'আবার চেষ্টা করুন।',
    },
    expired: {
      title: 'লিংকের মেয়াদ শেষ হয়েছে',
      subtitle: 'নতুন লিংক চান।',
    },
    clientMismatch: {
      title: 'লিংকটি অন্য ডিভাইসে খোলা হয়েছে',
      subtitle: 'যে ডিভাইসে সাইন ইন শুরু করেছিলেন সেখানে ফিরে যান।',
    },
  },
  phoneCode: {
    title: 'আপনার ফোন যাচাই করুন',
    subtitle: 'আপনার ফোনে পাঠানো কোডটি লিখুন।',
    formTitle: 'যাচাইকরণ কোড লিখুন',
    resendButton: 'কোড আবার পাঠান',
  },
  alternativePhoneCodeProvider: {
    formTitle: 'যাচাইকরণ কোড লিখুন',
    resendButton: 'কোড আবার পাঠান',
    subtitle: 'আপনার ফোনে পাঠানো কোডটি লিখুন।',
    title: '{{provider}} দিয়ে যাচাই করুন',
  },
  emailCodeMfa: {
    title: 'আপনার ইমেইল যাচাই করুন',
    subtitle: 'আপনার ইমেইলে পাঠানো কোডটি লিখুন।',
    formTitle: 'যাচাইকরণ কোড লিখুন',
    resendButton: 'কোড আবার পাঠান',
  },
  phoneCodeMfa: {
    title: 'আপনার ফোন যাচাই করুন',
    subtitle: 'আপনার ফোনে পাঠানো কোডটি লিখুন।',
    formTitle: 'যাচাইকরণ কোড লিখুন',
    resendButton: 'কোড আবার পাঠান',
  },
  totpMfa: {
    title: 'প্রমাণীকরণ কোড লিখুন',
    subtitle: 'আপনার প্রমাণীকরণ অ্যাপ থেকে কোডটি লিখুন।',
    formTitle: 'প্রমাণীকরণ কোড লিখুন',
  },
  backupCodeMfa: {
    title: 'আপনার ব্যাকআপ কোড লিখুন',
    subtitle: 'আপনার সংরক্ষিত ব্যাকআপ কোড ব্যবহার করুন।',
  },
  passkeyMfa: {
    title: 'পাসকি দিয়ে যাচাই করুন',
    subtitle: 'আপনার ডিভাইসের পাসকি ব্যবহার করে পরিচয় নিশ্চিত করুন।',
  },
  newDeviceVerificationNotice: 'নতুন ডিভাইস থেকে সাইন ইন করছেন। পরিচয় নিশ্চিত করতে অতিরিক্ত যাচাই প্রয়োজন হতে পারে।',
  alternativeMethods: {
    title: 'অন্য পদ্ধতি ব্যবহার করুন',
    subtitle: 'সাইন ইন চালিয়ে যাওয়ার জন্য একটি পদ্ধতি বেছে নিন।',
    actionLink: 'অন্য পদ্ধতি ব্যবহার করুন',
    actionText: 'সমস্যা হচ্ছে?',
    blockButton__emailLink: '{{identifier}} ঠিকানায় ইমেইল লিংক পাঠান',
    blockButton__emailCode: '{{identifier}} ঠিকানায় ইমেইল কোড পাঠান',
    blockButton__phoneCode: '{{identifier}} নম্বরে কোড পাঠান',
    blockButton__password: 'পাসওয়ার্ড ব্যবহার করুন',
    blockButton__passkey: 'পাসকি ব্যবহার করুন',
    blockButton__totp: 'প্রমাণীকরণ অ্যাপ ব্যবহার করুন',
    blockButton__backupCode: 'ব্যাকআপ কোড ব্যবহার করুন',
    getHelp: {
      title: 'সহায়তা নিন',
      content: 'সাইন ইন করতে সমস্যা হলে সহায়তার জন্য যোগাযোগ করুন।',
      blockButton__emailSupport: 'সহায়তায় ইমেইল করুন',
    },
  },
  noAvailableMethods: {
    title: 'সাইন ইন করা যাচ্ছে না',
    subtitle: 'এই অ্যাকাউন্টের জন্য কোনো সাইন ইন পদ্ধতি পাওয়া যায়নি।',
    message: 'আপনার প্রশাসকের সাথে যোগাযোগ করুন।',
  },
  accountSwitcher: {
    title: 'অ্যাকাউন্ট বেছে নিন',
    subtitle: 'চালিয়ে যেতে একটি অ্যাকাউন্ট বেছে নিন।',
    action__addAccount: 'অন্য অ্যাকাউন্ট যোগ করুন',
    action__signOutAll: 'সব অ্যাকাউন্ট থেকে সাইন আউট করুন',
  },
  protectCheck: {
    title: 'আপনার ব্রাউজার যাচাই করা হচ্ছে',
    subtitle: 'এই ধাপটি সম্পন্ন হলে সাইন ইন চলবে।',
    loading: 'অনুগ্রহ করে অপেক্ষা করুন।',
    retryButton: 'আবার চেষ্টা করুন',
  },
} satisfies ClerkSignInResource;
