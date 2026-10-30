export const reviewGenerationCopy = {
  en: {
    generate: 'Generate with Gemini', generated: 'Gemini explanation',
    disabled: 'Live generation is disabled. Local guidance is available.',
    unconfigured: 'Gemini is not configured. Local guidance is available.',
    busy: 'A review explanation is already being generated. Use local guidance.',
    limited: 'The application request limit was reached. Use local guidance.',
    timeout: 'Gemini timed out. Local guidance is available; retry only when ready.',
    rejected: 'Gemini rejected the request. Local guidance is available.',
    malformed: 'Gemini returned unusable advice. Local guidance is available.',
    unavailable: 'Gemini is unavailable or offline. Local guidance is available.',
  },
  bn: {
    generate: 'Gemini দিয়ে ব্যাখ্যা তৈরি করুন', generated: 'Gemini-এর ব্যাখ্যা',
    disabled: 'লাইভ ব্যাখ্যা বন্ধ আছে। স্থানীয় নির্দেশনা ব্যবহার করুন।',
    unconfigured: 'Gemini কনফিগার করা নেই। স্থানীয় নির্দেশনা ব্যবহার করুন।',
    busy: 'একটি ব্যাখ্যা ইতিমধ্যে তৈরি হচ্ছে। স্থানীয় নির্দেশনা ব্যবহার করুন।',
    limited: 'অ্যাপ্লিকেশনের অনুরোধের সীমা পূর্ণ হয়েছে। স্থানীয় নির্দেশনা ব্যবহার করুন।',
    timeout: 'Gemini-এর সময়সীমা শেষ হয়েছে। স্থানীয় নির্দেশনা আছে; প্রস্তুত হলে আবার চেষ্টা করুন।',
    rejected: 'Gemini অনুরোধ প্রত্যাখ্যান করেছে। স্থানীয় নির্দেশনা ব্যবহার করুন।',
    malformed: 'Gemini ব্যবহারযোগ্য ব্যাখ্যা দেয়নি। স্থানীয় নির্দেশনা ব্যবহার করুন।',
    unavailable: 'Gemini অনুপলব্ধ বা অফলাইন। স্থানীয় নির্দেশনা ব্যবহার করুন।',
  },
} as const;
