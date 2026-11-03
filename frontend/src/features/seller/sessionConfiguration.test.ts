import { describe, expect, it } from 'vitest';
import { validateSessionConfiguration } from './sessionConfiguration';

describe('production seller configuration', () => {
  it.each([undefined, '', 'pk_test_synthetic', 'sk_live_secret', 'pk_live_'])
  ('rejects missing or nonproduction publishable keys: %s', key => {
    expect(() => validateSessionConfiguration(key, true, false)).toThrow();
  });

  it('accepts a production publishable key', () => {
    expect(() => validateSessionConfiguration('pk_live_synthetic', true, false)).not.toThrow();
  });

  it('preserves credential-free local development and public buyer links', () => {
    expect(() => validateSessionConfiguration(undefined, false, false)).not.toThrow();
    expect(() => validateSessionConfiguration(undefined, true, true)).not.toThrow();
  });
});
