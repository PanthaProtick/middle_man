import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from './LocaleProvider';
import { LocaleSwitch } from './LocaleSwitch';
import { useLocale } from './context';
import { LOCALE_STORAGE_KEY } from './storage';

function Probe(): React.JSX.Element {
  const { locale, t } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="label">{t('locale.label')}</span>
      <LocaleSwitch />
    </div>
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.localStorage.clear();
});

async function mount(): Promise<void> {
  await act(async () => root.render(<LocaleProvider><Probe /></LocaleProvider>));
}

function languageButton(name: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button'))
    .find((candidate) => candidate.textContent === name);
  if (!button) throw new Error(`Missing language button ${name}`);
  return button;
}

describe('LocaleProvider and language switch', () => {
  it('starts in Bengali when the browser prefers Bengali', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['bn-BD', 'en-US']);
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('bn-BD');

    await mount();

    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe('bn');
    expect(container.querySelector('[data-testid="label"]')?.textContent).toBe('ভাষা');
    expect(document.documentElement.lang).toBe('bn-BD');
  });

  it('falls back to English for other browser languages and shows both switch labels', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR']);
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-FR');

    await mount();

    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(container.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Language');
    expect(languageButton('বাংলা')).toBeDefined();
    expect(languageButton('English')).toBeDefined();
    expect(languageButton('English').getAttribute('aria-pressed')).toBe('true');
  });

  it('lets an explicit stored choice override the browser preference', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['bn-BD']);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'en');

    await mount();

    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe('en');
  });

  it('ignores invalid stored values and uses the browser preference', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['bn-BD']);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'fr');

    await mount();

    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe('bn');
  });

  it('persists an explicit choice across mounts and keeps keyboard focus on the button', async () => {
    await mount();
    const bengali = languageButton('বাংলা');
    bengali.focus();

    await act(async () => bengali.click());

    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe('bn');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('bn');
    expect(document.documentElement.lang).toBe('bn-BD');
    expect(document.activeElement).toBe(bengali);
    expect(container.querySelector('[role="status"]')?.textContent).toBe('ভাষা: বাংলা');

    await act(async () => root.unmount());
    root = createRoot(container);
    await mount();

    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe('bn');
  });

  it('keeps switching available when browser storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });

    await mount();
    await act(async () => languageButton('বাংলা').click());

    expect(container.querySelector('[data-testid="locale"]')?.textContent).toBe('bn');
    expect(container.querySelector('[data-testid="label"]')?.textContent).toBe('ভাষা');
  });
});
