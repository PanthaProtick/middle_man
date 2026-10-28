import type { AuthReason } from './sessionRequest';
import type { Locale } from '../locale/storage';

const bengaliReasons: Record<AuthReason, string> = {
  expired: 'মেয়াদ শেষ',
  not_yet_valid: 'এখনও কার্যকর নয়',
  issuer_mismatch: 'ইস্যুকারী মেলেনি',
  audience_mismatch: 'প্রাপক মেলেনি',
  origin_mismatch: 'উৎস মেলেনি',
  invalid_signature: 'স্বাক্ষর সঠিক নয়',
  rejected: 'প্রত্যাখ্যাত',
};

export function sessionReason(reason: AuthReason, locale: Locale): string {
  return locale === 'bn' ? bengaliReasons[reason] : reason;
}
