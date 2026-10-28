import { act } from 'react';
import { createRoot, type Root as ReactRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Root } from './Root';
import { awaitingOrder } from './features/buyer/buyerLocaleFixtures';
import { LOCALE_STORAGE_KEY, LocaleProvider } from './features/locale';
import { clerkBengaliLocalization, type ClerkLocalizationResource } from './features/locale/clerkLocalization';
import { sellerCopy } from './features/locale/sellerCopy';

const clerk = vi.hoisted(() => ({
  getToken: vi.fn(), openSignIn: vi.fn(), signOut: vi.fn(),
  sessionId: 'session-alpha' as string | null | undefined,
  isSignedIn: true,
  isLoaded: true,
  providerMounts: 0,
  localizations: [] as Array<ClerkLocalizationResource | undefined>,
}));

vi.mock('@clerk/react', async () => {
  const React = await import('react');
  return {
    ClerkProvider: ({ children, localization }: {
      children: import('react').ReactNode;
      localization?: ClerkLocalizationResource;
    }) => {
      React.useEffect(() => {
        clerk.providerMounts += 1;
      }, []);
      clerk.localizations.push(localization);
      return React.createElement(React.Fragment, null, children);
    },
    useAuth: () => ({ ...clerk }),
    useClerk: () => clerk,
  };
});

let container: HTMLDivElement;
let root: ReactRoot;

beforeEach(() => {
  clerk.sessionId = 'session-alpha';
  clerk.isSignedIn = true;
  clerk.isLoaded = true;
  clerk.providerMounts = 0;
  clerk.localizations = [];
  clerk.getToken.mockReset().mockResolvedValue('signed-session-token');
  clerk.signOut.mockReset().mockResolvedValue(undefined);
  clerk.openSignIn.mockReset().mockResolvedValue(undefined);
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(
    url.includes('/seller/shop') ? { setup_needed: true, shop: null } : { status: 'healthy' },
  ), { status: 200 })));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
});

function languageButton(name: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button'))
    .find((candidate) => candidate.textContent === name);
  if (!button) throw new Error(`Missing language button ${name}`);
  return button;
}

describe('application root locale and Clerk integration', () => {
  it('switches the Clerk localization with the shared selection without remounting the session', async () => {
    await act(async () => root.render(
      <LocaleProvider><Root publishableKey="pk_test_synthetic" /></LocaleProvider>,
    ));

    expect(container.textContent).toContain('Shop Setup');
    expect(clerk.localizations.at(-1)).toBeUndefined();
    expect(clerk.providerMounts).toBe(1);
    const tokenRequests = clerk.getToken.mock.calls.length;

    await act(async () => languageButton('বাংলা').click());

    expect(container.textContent).toContain(sellerCopy.bn.setup);
    expect(clerk.localizations.at(-1)).toBe(clerkBengaliLocalization);
    expect(clerk.providerMounts).toBe(1);
    expect(clerk.getToken).toHaveBeenCalledTimes(tokenRequests);
    expect(clerk.signOut).not.toHaveBeenCalled();

    await act(async () => languageButton('English').click());

    expect(clerk.localizations.at(-1)).toBeUndefined();
    expect(clerk.providerMounts).toBe(1);
    expect(clerk.getToken).toHaveBeenCalledTimes(tokenRequests);
  });

  it('keeps the public buyer link outside Clerk and outside the authenticated session', async () => {
    window.history.replaceState({}, '', '/orders/shared-token');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(awaitingOrder))));

    await act(async () => root.render(
      <LocaleProvider>
        <Root publishableKey="pk_test_synthetic" publicPortal />
      </LocaleProvider>,
    ));

    expect(container.textContent).toContain('Order confirmation');
    expect(clerk.providerMounts).toBe(0);
    expect(clerk.localizations).toHaveLength(0);
    expect(clerk.getToken).not.toHaveBeenCalled();
  });

  it('keeps the saved device choice when the root remounts', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'bn');

    await act(async () => root.render(
      <LocaleProvider><Root publishableKey="pk_test_synthetic" /></LocaleProvider>,
    ));

    expect(clerk.localizations.at(-1)).toBe(clerkBengaliLocalization);
    expect(container.textContent).toContain(sellerCopy.bn.setup);
  });
});
