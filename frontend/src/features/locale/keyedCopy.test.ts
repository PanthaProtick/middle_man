import { describe, expect, it } from 'vitest';
import { keyedCopy } from './keyedCopy';

const dictionaries = {
  en: { known: 'English known' },
  bn: { known: 'বাংলা জানা' },
};

describe('English-keyed copy lookup', () => {
  it('resolves the selected language dictionary', () => {
    expect(keyedCopy('en', dictionaries, 'known')).toBe('English known');
    expect(keyedCopy('bn', dictionaries, 'known')).toBe('বাংলা জানা');
  });

  it('falls back to the English key or an explicit fallback for missing entries', () => {
    expect(keyedCopy('en', dictionaries, 'missing')).toBe('missing');
    expect(keyedCopy('bn', dictionaries, 'missing')).toBe('missing');
    expect(keyedCopy('bn', dictionaries, 'missing', 'নিরাপদ উত্তর')).toBe('নিরাপদ উত্তর');
    expect(keyedCopy('en', { en: {}, bn: dictionaries.bn }, 'missing')).toBe('missing');
  });
});
