import { describe, expect, it } from 'vitest';
import { validateSessionConfiguration } from './sessionConfiguration';

it('requires a development Clerk key when hosted development is explicitly selected', () => {
  expect(() => validateSessionConfiguration('pk_test_synthetic', true, false, 'production', 'hosted-development')).not.toThrow();
  for (const key of [undefined, '', 'pk_test_', 'pk_live_synthetic', 'sk_test_secret', 'pk_test_your_clerk_key']) {
    expect(() => validateSessionConfiguration(key, true, false, 'production', 'hosted-development')).toThrow();
  }
  expect(() => validateSessionConfiguration('pk_test_synthetic', true, false, 'production', 'typo')).toThrow();
});

it('permits a separate development Clerk instance in an optimized Vercel preview build', () => {
  expect(() => validateSessionConfiguration('pk_test_synthetic', true, false, 'preview')).not.toThrow();
  expect(() => validateSessionConfiguration(undefined, true, false, 'preview')).not.toThrow();
  expect(() => validateSessionConfiguration('pk_test_synthetic', true, false, 'production')).toThrow();
});

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
