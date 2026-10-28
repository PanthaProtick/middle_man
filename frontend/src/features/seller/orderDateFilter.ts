import { normalizeBengaliDigits } from '../locale/format';

export type OrderDateMode = 'any' | 'today' | 'custom' | 'relative';
export type OrderDateError =
  | 'range_required'
  | 'range_invalid'
  | 'range_reversed'
  | 'days_invalid';

export interface OrderDateRange {
  /** Inclusive Bangladesh calendar date, YYYY-MM-DD. */
  from: string;
  /** Inclusive Bangladesh calendar date, YYYY-MM-DD. */
  to: string;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WHOLE_DAYS = /^\d+$/;

function utcDate(year: number, month: number, day: number): Date {
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(year, month - 1, day);
  return value;
}

export function bangladeshToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value.trim());
  if (!match) return false;
  const [, year, month, day] = match;
  const date = utcDate(Number(year), Number(month), Number(day));
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

export function shiftIsoDate(value: string, days: number): string {
  const match = ISO_DATE.exec(value.trim());
  if (!match) return value;
  const [, year, month, day] = match;
  const date = utcDate(Number(year), Number(month), Number(day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function lastDaysRange(days: number, now: Date = new Date()): OrderDateRange {
  const to = bangladeshToday(now);
  return { from: shiftIsoDate(to, -(days - 1)), to };
}

export function validateCustomRange(from: string, to: string): OrderDateError | null {
  const start = from.trim();
  const end = to.trim();
  if (!start || !end) return 'range_required';
  if (!isValidIsoDate(start) || !isValidIsoDate(end)) return 'range_invalid';
  if (start > end) return 'range_reversed';
  return null;
}

export function parseDayCount(value: string): number | null {
  const cleaned = normalizeBengaliDigits(value).trim();
  if (!WHOLE_DAYS.test(cleaned)) return null;
  const days = Number(cleaned);
  return days >= 1 && days <= 3650 ? days : null;
}

export function validateDayCount(value: string): OrderDateError | null {
  return parseDayCount(value) === null ? 'days_invalid' : null;
}
