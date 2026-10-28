const en = {
  title: 'Developer details (for support)', copyTitle: 'Copy diagnostic information for technical support',
  copied: 'Copied to clipboard', copy: 'Copy dev info', region: 'Developer diagnostic details',
  orderId: 'Order ID:', version: 'Version:', basis: 'Allocation Basis:', accountId: 'Payment Account ID:',
  predecessor: 'Predecessor Order ID:', replacement: 'Replaced by Order ID:', token: 'Portal Token:',
  revision: 'Buyer Revision:', reasons: 'Raw Review Reasons:', deadlines: 'Server Deadlines:',
  created: 'Created', expires: 'Expires',
} as const;
const bn: Record<keyof typeof en, string> = {
  title: 'কারিগরি তথ্য (সহায়তার জন্য)', copyTitle: 'কারিগরি সহায়তার জন্য ডায়াগনস্টিক তথ্য কপি করুন',
  copied: 'ক্লিপবোর্ডে কপি হয়েছে', copy: 'কারিগরি তথ্য কপি করুন', region: 'কারিগরি ডায়াগনস্টিক তথ্য',
  orderId: 'অর্ডার আইডি:', version: 'সংস্করণ:', basis: 'বরাদ্দের ভিত্তি:', accountId: 'পেমেন্ট অ্যাকাউন্ট আইডি:',
  predecessor: 'আগের অর্ডারের আইডি:', replacement: 'বদলে তৈরি অর্ডারের আইডি:', token: 'পোর্টাল টোকেন:',
  revision: 'ক্রেতার তথ্যের সংস্করণ:', reasons: 'পর্যালোচনার মূল কোড:', deadlines: 'সার্ভারের সময়সীমা:',
  created: 'তৈরি হয়েছে', expires: 'মেয়াদ শেষ হবে',
};
export const orderDiagnosticCopy = { en, bn };
