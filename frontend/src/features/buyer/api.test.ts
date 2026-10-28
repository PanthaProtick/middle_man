import { expect, it } from 'vitest';
import { parseClaimedAmount } from './api';

it('converts decimal BDT text to exact safe integer minor units', () => {
  expect(parseClaimedAmount('12.01')).toBe(1201);
  expect(parseClaimedAmount('0.29')).toBe(29);
  expect(parseClaimedAmount('90071992547409.91')).toBe(Number.MAX_SAFE_INTEGER);
  expect(parseClaimedAmount('১২.০১')).toBe(1201);
  expect(parseClaimedAmount('০.২৯')).toBe(29);
  expect(parseClaimedAmount('৯০০৭১৯৯২৫৪৭৪০৯.৯১')).toBe(Number.MAX_SAFE_INTEGER);
});

it.each(['', '0', '-1', '1.001', '1e2', 'Infinity', '90071992547409.92', '০', '-১', '১.০০১', '৯০০৭১৯৯২৫৪৭৪০৯.৯২'])('rejects unsupported money input %s', (value) => {
  expect(() => parseClaimedAmount(value)).toThrow();
});
