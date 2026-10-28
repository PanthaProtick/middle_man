import type { Locale } from './storage';

const BENGALI_MONTHS = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

const ENGLISH_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const BANGLADESH_TIME_LABEL = { en: 'Bangladesh time', bn: 'বাংলাদেশ সময়' } as const;

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dhaka',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

/** Money always uses 0-9 digits and two decimal places in both languages. */
export function formatBdt(minor: number): string {
  const bdt = minor / 100;
  return `৳${bdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Renders an unambiguous Gregorian date (day, month name, year) and time in
 * Bangladesh time. Month names are localized; digits stay 0-9 in both languages.
 */
export function formatBangladeshDateTime(isoString: string, locale: Locale): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;

  const parts = partsFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';

  const day = part('day');
  const monthIndex = Number(part('month')) - 1;
  const year = part('year');
  const hour = part('hour');
  const minute = part('minute');
  const period = part('dayPeriod');
  const month = locale === 'bn' ? BENGALI_MONTHS[monthIndex] : ENGLISH_MONTHS[monthIndex];

  if (!day || !year || !month || !hour || !minute) return isoString;
  return `${day} ${month} ${year}, ${hour}:${minute} ${period} (${BANGLADESH_TIME_LABEL[locale]})`;
}

/** Operational counts use 0-9 digits in either language. */
export function formatCount(count: number): string {
  return count.toLocaleString('en-US');
}
