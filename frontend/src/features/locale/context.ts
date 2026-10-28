import { createContext, useContext } from 'react';
import { catalogs, interpolate, type MessageKey, type MessageParams } from './catalog';
import type { Locale } from './storage';

export type Translate = (key: MessageKey, params?: MessageParams) => string;

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
  /** True only for the provider that owns the device locale state. */
  provided: boolean;
}

export const englishTranslate: Translate = (key, params) => interpolate(catalogs.en[key], params);

export const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => undefined,
  t: englishTranslate,
  provided: false,
});

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
