import { expect, it, vi } from 'vitest';
import { apiUrl } from './apiUrl';

it.each([
  'https://api.example.test/api',
  'https://api.example.test/api/',
])('preserves encoded paths and query parameters with base %s', base => {
  vi.stubEnv('VITE_API_BASE_URL', base);
  expect(apiUrl('/api/seller/orders/a%2Fb?cursor=c%2Fd'))
    .toBe('https://api.example.test/api/seller/orders/a%2Fb?cursor=c%2Fd');
});

it.each([
  'api.example.test/api',
  '//api.example.test/api',
  'ftp://api.example.test/api',
  'https://user:password@api.example.test/api',
  'https://api.example.test/api?redirect=elsewhere',
  'https://api.example.test/api#fragment',
])('rejects an invalid configured API destination: %s', base => {
  vi.stubEnv('VITE_API_BASE_URL', base);
  expect(() => apiUrl('/api/seller/shop')).toThrow();
});

it('rejects caller-supplied external URLs instead of sending seller credentials there', () => {
  expect(() => apiUrl('https://foreign.example/api/seller/shop')).toThrow();
});
