export type Locale = 'bn' | 'en';

export const LOCALE_STORAGE_KEY = 'middleman.locale';

export function isLocale(value: unknown): value is Locale {
  return value === 'bn' || value === 'en';
}

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Some privacy modes throw before returning the storage object.
    return null;
  }
}

export function readStoredLocale(storage: Storage | null = browserStorage()): Locale | null {
  try {
    const value = storage?.getItem(LOCALE_STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function persistLocale(locale: Locale, storage: Storage | null = browserStorage()): void {
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage can be full or blocked; the in-memory choice still applies.
  }
}

export function detectBrowserLocale(navigatorLike: Pick<Navigator, 'language' | 'languages'> | undefined = globalThis.navigator): Locale {
  const languages = navigatorLike?.languages?.length
    ? navigatorLike.languages
    : navigatorLike?.language
      ? [navigatorLike.language]
      : [];
  const preferred = languages[0]?.toLowerCase();
  return preferred?.startsWith('bn') ? 'bn' : 'en';
}

export function resolveInitialLocale(): Locale {
  return readStoredLocale() ?? detectBrowserLocale();
}
