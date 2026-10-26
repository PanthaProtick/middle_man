import { expect, it } from 'vitest';
import { parseParcelQuantity, parseParcelWeightKg } from './parcel';

it('parses bounded parcel weights into integer grams', () => {
  expect(parseParcelWeightKg('0.001')).toBe(1);
  expect(parseParcelWeightKg('1.5')).toBe(1500);
  expect(parseParcelWeightKg('1.005')).toBe(1005);
  expect(parseParcelWeightKg('1000')).toBe(1_000_000);
  expect(() => parseParcelWeightKg('0')).toThrow('between');
  expect(() => parseParcelWeightKg('1.2345')).toThrow('decimal');
  expect(() => parseParcelWeightKg('1000.001')).toThrow('between');
});

it('parses bounded whole-number parcel quantities', () => {
  expect(parseParcelQuantity('1')).toBe(1);
  expect(parseParcelQuantity('10000')).toBe(10_000);
  expect(() => parseParcelQuantity('0')).toThrow('between');
  expect(() => parseParcelQuantity('1.5')).toThrow('whole');
  expect(() => parseParcelQuantity('10001')).toThrow('between');
});
