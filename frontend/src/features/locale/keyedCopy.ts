import type { Locale } from './storage';

export interface LocalizedDictionaries {
  en: Record<string, string>;
  bn: Record<string, string>;
}

/**
 * Resolves copy written in English-keyed dictionaries. The Bengali entry is
 * preferred for Bengali; a missing entry falls back to the supplied fallback or
 * to the English key, so an unknown key never disappears from the interface.
 */
export function keyedCopy(
  locale: Locale,
  dictionaries: LocalizedDictionaries,
  key: string,
  fallback?: string,
): string {
  return dictionaries[locale][key] ?? fallback ?? key;
}
