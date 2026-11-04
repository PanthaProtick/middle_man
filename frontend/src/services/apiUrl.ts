/** Product callers use /api paths; Vite's local proxy handles an unset base. */
export function apiUrl(path: string, fallback = ''): string {
  if (!path.startsWith('/api/')) throw new Error('Expected an application API path');
  const base = (import.meta.env.VITE_API_BASE_URL || fallback).trim().replace(/\/+$/, '');
  if (!base) return path;
  const parsed = new URL(base);
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password
    || parsed.search || parsed.hash) {
    throw new Error('VITE_API_BASE_URL must be an HTTP(S) API URL without credentials, query or fragment');
  }
  return `${base}${path.slice('/api'.length)}`;
}
