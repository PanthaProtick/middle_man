import { sellerCopy } from '../locale/sellerCopy';
import type { Locale } from '../locale/storage';

export function workspaceErrorText(error: string | { code: string } | null, locale: Locale): string | null {
  if (typeof error === 'string' || error === null) return error;
  const text = sellerCopy[locale];
  switch (error.code) {
    case 'DURABLE_STORAGE_UNAVAILABLE': return text.storage;
    case 'INVALID_NAME': return text.invalidName;
    case 'NAME_LIMIT': return text.nameLimit;
    case 'IDEMPOTENCY_KEY_REUSED': return text.conflict;
    case 'RECOVERY_FAILED': return text.recoveryFailed;
    default: return text.failure;
  }
}
