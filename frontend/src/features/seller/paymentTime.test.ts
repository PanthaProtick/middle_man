import { expect, it } from 'vitest';
import { currentPaymentTime } from './paymentTime';

it('formats the current browser-local time for a datetime-local input', () => {
  expect(currentPaymentTime(new Date(2026, 10, 4, 9, 7, 42))).toBe('2026-11-04T09:07');
});
