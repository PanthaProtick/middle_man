import type { Locale } from '../locale';

export interface HeroShowcaseStep {
  tab: string;
  title: string;
  orderNumber: string;
  item: string;
  itemDetail: string;
  totalLabel: string;
  totalValue: string;
  advanceLabel: string;
  advanceValue: string;
  primaryMetricLabel: string;
  primaryMetricValue: string;
  statusChip: string;
  note: string;
}

export interface HeroShowcaseContent {
  deskLabel: string;
  activeStatus: string;
  introHeadline: string;
  steps: {
    link: HeroShowcaseStep;
    match: HeroShowcaseStep;
    courier: HeroShowcaseStep;
  };
  guarantees: Array<{ id: string; label: string }>;
}

export const heroShowcaseCopy: Record<Locale, HeroShowcaseContent> = {
  en: {
    deskLabel: 'Middleman Shop Desk',
    activeStatus: 'Dhaka Operations Active',
    introHeadline: 'Protecting your social commerce sales from agreed chat to verified courier delivery',
    steps: {
      link: {
        tab: '1. Buyer Link',
        title: 'Single-order link generated in chat',
        orderNumber: 'Order #DH-8492',
        item: 'Dhaka Handloom Jamdani Saree',
        itemDetail: 'White & Gold · 1 pc',
        totalLabel: 'Total Bill',
        totalValue: '৳3,200',
        advanceLabel: 'Required Advance',
        advanceValue: '৳150',
        primaryMetricLabel: 'Confirmation Link',
        primaryMetricValue: 'middleman.app/orders/dh-8492',
        statusChip: 'Link Active in Chat',
        note: 'Customer opens their individual link on mobile web to review terms, input address, and pay delivery advance.',
      },
      match: {
        tab: '2. Payment Match',
        title: 'Two-way bKash & Nagad reconciliation',
        orderNumber: 'Claim #DH-8492',
        item: 'Dhaka Handloom Jamdani Saree',
        itemDetail: 'White & Gold · 1 pc',
        totalLabel: 'Payment Claim',
        totalValue: 'bKash · ৳150',
        advanceLabel: 'Claimed TrxID',
        advanceValue: 'BL9X4M291Q',
        primaryMetricLabel: 'Reconciliation Result',
        primaryMetricValue: 'Matched with Merchant SMS',
        statusChip: 'Advance Verified',
        note: 'No fake payment screenshots or manual bank checking. Advance is verified and locked before packaging.',
      },
      courier: {
        tab: '3. Pathao Dispatch',
        title: '1-tap courier dispatch with exact COD',
        orderNumber: 'Consignment #PATHAO-8492',
        item: 'Dhaka Handloom Jamdani Saree',
        itemDetail: 'White & Gold · 1 pc',
        totalLabel: 'Remaining COD',
        totalValue: '৳3,050',
        advanceLabel: 'Advance Deducted',
        advanceValue: '৳150 Paid',
        primaryMetricLabel: 'Delivery Destination',
        primaryMetricValue: 'Mirpur-2, Dhaka Zone',
        statusChip: 'Ready for Pickup',
        note: 'Address and delivery zone are verified. Consignment is staged into Pathao with auto-calculated COD in seconds.',
      },
    },
    guarantees: [
      { id: 'advance', label: '100% Advance Guarded' },
      { id: 'match', label: '2-Way TrxID Matching' },
      { id: 'dispatch', label: '1-Tap Pathao Handoff' },
    ],
  },
  bn: {
    deskLabel: 'মধ্যস্বত্ব শপ ডেস্ক',
    activeStatus: 'ঢাকা শপ অপারেশন সক্রিয়',
    introHeadline: 'চ্যাটে কথা চূড়ান্ত হওয়া থেকে কুরিয়ার ডেলিভারি পর্যন্ত বিক্রেতার সম্পূর্ণ সুরক্ষা',
    steps: {
      link: {
        tab: '১. ক্রেতা লিংক',
        title: 'চ্যাটে সিঙ্গেল অর্ডার কনফার্মেশন লিংক',
        orderNumber: 'অর্ডার #DH-৮৪৯২',
        item: 'ঢাকার তাঁতের জামদানি শাড়ি',
        itemDetail: 'সাদা ও সোনালি পাড় · ১টি',
        totalLabel: 'মোট বিল',
        totalValue: '৳৩,২০০',
        advanceLabel: 'আবশ্যক অগ্রিম',
        advanceValue: '৳১৫০',
        primaryMetricLabel: 'কনফার্মেশন লিংক',
        primaryMetricValue: 'middleman.app/orders/dh-8492',
        statusChip: 'চ্যাটে লিংক সক্রিয়',
        note: 'ক্রেতা লিংকে প্রবেশ করে পণ্যের বিবরণ দেখেন, ঠিকানা প্রদান করেন এবং ডেলিভারি অগ্রিম পাঠিয়ে দেন।',
      },
      match: {
        tab: '২. পেমেন্ট মেলানো',
        title: 'স্বয়ংক্রিয় বিকাশ ও নগদ ট্রানজাকশন যাচাই',
        orderNumber: 'দাবি #DH-৮৪৯২',
        item: 'ঢাকার তাঁতের জামদানি শাড়ি',
        itemDetail: 'সাদা ও সোনালি পাড় · ১টি',
        totalLabel: 'পেমেন্ট দাবি',
        totalValue: 'বিকাশ · ৳১৫০',
        advanceLabel: 'দাবিকৃত TrxID',
        advanceValue: 'BL9X4M291Q',
        primaryMetricLabel: 'যাচাই ফলাফল',
        primaryMetricValue: 'মার্চেন্ট এসএমএস-এর সাথে মিল পাওয়া গেছে',
        statusChip: 'অগ্রিম নিশ্চিত',
        note: 'ভুয়া স্ক্রিনশট বা ব্যাংকিং বিভ্রান্তির অবসান। পার্সেল প্যাক করার আগেই অগ্রিম নিশ্চিত ও সংরক্ষিত।',
      },
      courier: {
        tab: '৩. পাঠাও বুকিং',
        title: 'সঠিক ক্যাশ-অন-ডেলিভারিতে ১-ট্যাপ পাঠাও বুকিং',
        orderNumber: 'কনসাইনমেন্ট #PATHAO-৮৪৯২',
        item: 'ঢাকার তাঁতের জামদানি শাড়ি',
        itemDetail: 'সাদা ও সোনালি পাড় · ১টি',
        totalLabel: 'বাকি COD কালেকশন',
        totalValue: '৳৩,০৫০',
        advanceLabel: 'অগ্রিম সমন্বয়',
        advanceValue: '৳১৫০ পরিশোধিত',
        primaryMetricLabel: 'ডেলিভারি এরিয়া',
        primaryMetricValue: 'মিরপুর-২, ঢাকা জোন',
        statusChip: 'পিকআপের জন্য প্রস্তুত',
        note: 'ঢাকার এরিয়া ও ফোন নম্বর যাচাই করে সরাসরি পাঠাও সিস্টেমে নির্ভুল ক্যাশ-অন-ডেলিভারিতে বুকিং সম্পন্ন।',
      },
    },
    guarantees: [
      { id: 'advance', label: '১০০% অগ্রিম সুরক্ষিত' },
      { id: 'match', label: 'নিখুঁত TrxID মেলানো' },
      { id: 'dispatch', label: '১-ট্যাপ পাঠাও বুকিং' },
    ],
  },
};
