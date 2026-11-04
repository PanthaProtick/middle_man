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
    introHeadline: 'The details behind each parcel, from buyer link to courier preparation.',
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
        primaryMetricValue: 'Matched with Seller Record',
        statusChip: 'Advance Accepted',
        note: 'Record the payment from your payment app and review the buyer claim. Accepted advances stay linked to their order; matching is not provider verification.',
      },
      courier: {
        tab: '3. Pathao Dispatch',
        title: 'Prepare a Pathao handoff with remaining COD',
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
        note: 'Review the address, delivery zone, and remaining COD before authorizing a Pathao submission.',
      },
    },
    guarantees: [
      { id: 'advance', label: 'Clear Advance & COD' },
      { id: 'match', label: 'Compare Payment Records' },
      { id: 'dispatch', label: 'Review Courier Details' },
    ],
  },
  bn: {
    deskLabel: 'মধ্যস্বত্ব শপ ডেস্ক',
    activeStatus: 'ঢাকা শপ অপারেশন সক্রিয়',
    introHeadline: 'ক্রেতার লিংক থেকে কুরিয়ারের প্রস্তুতি, প্রতিটি পার্সেলের খুঁটিনাটি একসঙ্গে।',
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
        title: 'বিকাশ ও নগদের পেমেন্ট রেকর্ড মেলানো',
        orderNumber: 'দাবি #DH-৮৪৯২',
        item: 'ঢাকার তাঁতের জামদানি শাড়ি',
        itemDetail: 'সাদা ও সোনালি পাড় · ১টি',
        totalLabel: 'পেমেন্ট দাবি',
        totalValue: 'বিকাশ · ৳১৫০',
        advanceLabel: 'দাবিকৃত TrxID',
        advanceValue: 'BL9X4M291Q',
        primaryMetricLabel: 'যাচাই ফলাফল',
        primaryMetricValue: 'বিক্রেতার পেমেন্ট রেকর্ডের সাথে মিল পাওয়া গেছে',
        statusChip: 'অগ্রিম নিশ্চিত',
        note: 'পেমেন্ট অ্যাপ থেকে পাওয়া তথ্য রেকর্ড করে ক্রেতার দাবির সঙ্গে মিলিয়ে দেখুন। এই মিল পেমেন্ট প্রদানকারীর স্বাধীন যাচাই নয়।',
      },
      courier: {
        tab: '৩. পাঠাও বুকিং',
        title: 'বাকি ক্যাশ-অন-ডেলিভারিসহ পাঠাও বুকিংয়ের প্রস্তুতি',
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
        note: 'পাঠাও বুকিংয়ের অনুমতি দেওয়ার আগে ঠিকানা, ডেলিভারি এরিয়া ও বাকি ক্যাশ-অন-ডেলিভারি দেখে নিন।',
      },
    },
    guarantees: [
      { id: 'advance', label: 'অগ্রিম ও বাকির স্পষ্ট হিসাব' },
      { id: 'match', label: 'পেমেন্ট রেকর্ড মেলানো' },
      { id: 'dispatch', label: 'কুরিয়ারের তথ্য পর্যালোচনা' },
    ],
  },
};
