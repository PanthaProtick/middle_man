import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { catalogs, interpolate } from './catalog';
import { LocaleContext, type LocaleContextValue, type Translate } from './context';
import { persistLocale, resolveInitialLocale, type Locale } from './storage';

interface LocaleProviderProps {
  children: ReactNode;
}

export function LocaleProvider({ children }: LocaleProviderProps): React.JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(resolveInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const t = useCallback<Translate>(
    (key, params) => interpolate(catalogs[locale][key], params),
    [locale],
  );

  const value = useMemo<LocaleContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  useEffect(() => {
    document.documentElement.lang = locale === 'bn' ? 'bn-BD' : 'en';
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
