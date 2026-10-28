import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LocaleProvider, useLocale } from '../locale';
import { sellerCopy } from '../locale/sellerCopy';
import { SellerSession } from './SellerSession';

const clerk = vi.hoisted(() => ({
  getToken: vi.fn(), openSignIn: vi.fn(), signOut: vi.fn(),
  sessionId: 'session-alpha' as string | null | undefined, isSignedIn: true,
  isLoaded: true,
}));
vi.mock('@clerk/react', () => ({
  SignIn: () => <div data-testid="embedded-sign-in">Embedded sign-in</div>,
  useAuth: () => ({ ...clerk }),
  useClerk: () => clerk,
}));
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.localStorage.clear();
  document.title = '';
  clerk.sessionId = 'session-alpha';
  clerk.isSignedIn = true;
  clerk.isLoaded = true;
  clerk.getToken.mockReset().mockResolvedValue('signed-session-token');
  clerk.signOut.mockReset().mockResolvedValue(undefined);
  clerk.openSignIn.mockReset().mockResolvedValue(undefined);
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
  vi.unstubAllGlobals();
});
it('shows initialization rather than a missing-configuration diagnosis while Clerk loads', async () => {
  clerk.isLoaded = false;
  clerk.sessionId = undefined;
  await act(async () => root.render(<SellerSession />));
  expect(container.textContent).toContain('Loading seller sign-in');
  expect(document.title).toBe('Seller workspace · middleman');
  expect(container.textContent).not.toContain('Configure Clerk');
  expect(container.textContent).not.toContain('Session verification is unavailable');
  expect(clerk.getToken).not.toHaveBeenCalled();
});
it('does not invent a verification failure for an absent signed-out session', async () => {
  clerk.sessionId = undefined;
  clerk.isSignedIn = false;
  await act(async () => root.render(<SellerSession />));
  expect(container.textContent).not.toContain('Session verification is unavailable');
  const button = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Sign in');
  await act(async () => button?.click());
  expect(container.querySelector('[data-testid="embedded-sign-in"]')).not.toBeNull();
});
it('obtains a Clerk token for shop access and signs out through Clerk', async () => {
  await act(async () => root.render(<SellerSession />));
  expect(clerk.getToken).toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/seller/shop'), expect.objectContaining({
    headers: expect.objectContaining({ Authorization: 'Bearer signed-session-token' }),
  }));
  expect(container.textContent).toContain('Shop Setup');
  const button = container.querySelector<HTMLButtonElement>('button[title="Sign out of seller account"]');
  await act(async () => button?.click());
  expect(clerk.signOut).toHaveBeenCalled();
  expect(container.textContent).not.toContain('Shop Setup');
});
it('opens Clerk sign-in without sending a development credential', async () => {
  clerk.isSignedIn = false;
  clerk.sessionId = null;
  await act(async () => root.render(<SellerSession />));
  const button = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Sign in');
  await act(async () => button?.click());
  expect(container.querySelector('[data-testid="embedded-sign-in"]')).not.toBeNull();
  expect(clerk.getToken).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('/seller/'), expect.anything());
});
it('shows token acquisition failures without opening a private workspace', async () => {
  clerk.getToken.mockRejectedValue(new Error('Provider offline'));
  await act(async () => root.render(<SellerSession />));
  expect(container.textContent).toContain('Unable to obtain your seller session');
  expect(container.textContent).not.toContain('Shop Setup');
});

it.each([401, 503])('hides private content on session verification failure %s and allows recovery', async (status) => {
  vi.mocked(fetch).mockImplementation(async (url) => new Response(JSON.stringify(
    String(url).includes('/seller/shop') ? { setup_needed: false, shop: { id: 'alpha', display_name: 'Private Alpha Shop' } }
      : String(url).includes('payment-accounts') ? [] : { items: [], next_cursor: null },
  ), { status: 200 }));
  await act(async () => root.render(<SellerSession />));
  expect(container.textContent).toContain('Private Alpha Shop');
  vi.mocked(fetch).mockImplementation(async (url) => new Response(JSON.stringify(
    String(url).includes('/seller/')
      ? { error: { code: status === 401 ? 'UNAUTHORIZED' : 'AUTH_UNAVAILABLE', message: 'Verification failed' } }
      : { status: 'healthy' },
  ), { status: String(url).includes('/seller/') ? status : 200 }));
  const refresh = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Refresh');
  expect(refresh).not.toBeNull();
  await act(async () => refresh?.click());
  expect(container.textContent).not.toContain('Private Alpha Shop');
  expect(container.textContent).toContain(status === 401 ? 'sign in again' : 'verification is unavailable');
  vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ setup_needed: true, shop: null })));
  const retry = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Retry seller session');
  await act(async () => retry?.click());
  expect(container.textContent).toContain('Shop Setup');
  expect(container.textContent).not.toContain('Private Alpha Shop');
});


it.each(['sign-out', 'identity-change', 'expiry'])('discards a late private response after %s', async (change) => {
  let deliver!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(async (url) => {
    if (String(url).includes('/seller/shop')) return new Promise<Response>(resolve => { deliver = resolve; });
    return new Response(JSON.stringify({ status: 'healthy' }));
  });
  await act(async () => root.render(<SellerSession />));
  if (change === 'sign-out') {
    await act(async () => container.querySelector<HTMLButtonElement>('button[title="Sign out of seller account"]')?.click());
  } else {
    clerk.sessionId = change === 'expiry' ? null : 'session-beta';
    clerk.isSignedIn = change !== 'expiry';
    clerk.getToken.mockResolvedValue('beta-token');
    // The new identity remains at setup; the old request ignores AbortSignal on purpose.
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ setup_needed: true, shop: null })));
    await act(async () => root.render(<SellerSession />));
  }
  await act(async () => deliver(new Response(JSON.stringify({
    setup_needed: false, shop: { id: 'alpha', display_name: 'Late Private Alpha' },
  }))));
  expect(container.textContent).not.toContain('Late Private Alpha');
  expect(container.textContent).toContain(change === 'identity-change' ? 'Shop Setup' : 'Sign in to your shop');
});

it('recovers automatically after a transient periodic token acquisition failure', async () => {
  vi.useFakeTimers();
  try {
    await act(async () => root.render(<SellerSession />));
    expect(container.textContent).toContain('Shop Setup');
    clerk.getToken.mockResolvedValue(null);
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(container.textContent).not.toContain('Shop Setup');
    expect(container.textContent).toContain('Unable to obtain your seller session');
    clerk.getToken.mockResolvedValue('renewed-session-token');
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(container.textContent).toContain('Shop Setup');
    expect(container.textContent).not.toContain('Unable to obtain your seller session');
  } finally { vi.useRealTimers(); }
});

it('makes Sign in recover a rejected session when Clerk still considers the user signed in', async () => {
  vi.mocked(fetch).mockImplementation(async (url) => String(url).includes('/seller/')
    ? Response.json({ error: { code: 'UNAUTHORIZED', message: 'Rejected' } }, { status: 401 })
    : Response.json({ status: 'healthy' }));
  await act(async () => root.render(<SellerSession />));
  expect(container.textContent).toContain('Your seller session has expired');
  vi.mocked(fetch).mockImplementation(async () => Response.json({ setup_needed: true, shop: null }));
  const signIn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Sign in');
  await act(async () => signIn?.click());
  expect(container.textContent).toContain('Shop Setup');
  expect(clerk.openSignIn).not.toHaveBeenCalled();
});

it('shows the safe rejection category without needing the aborted response body', async () => {
  vi.mocked(fetch).mockImplementation(async (url) => String(url).includes('/seller/')
    ? new Response('{}', { status: 401, headers: { 'X-Seller-Auth-Reason': 'not_yet_valid' } })
    : Response.json({ status: 'healthy' }));
  await act(async () => root.render(<SellerSession />));
  expect(container.textContent).toContain('Session diagnostic: not_yet_valid');
  expect(container.textContent).not.toContain('Shop Setup');
});

it('preserves an unfinished courier form when the same Clerk session renews its token', async () => {
  vi.useFakeTimers();
  try {
    vi.mocked(fetch).mockImplementation(async (url) => Response.json(
      String(url).includes('/seller/shop')
        ? { setup_needed: false, shop: { id: 'alpha', display_name: 'Alpha' } }
        : String(url).includes('/courier/pathao/')
          ? { environment: 'sandbox', version: 0, status: 'disconnected', simulated: false }
          : String(url).includes('payment-accounts') ? [] : { items: [], next_cursor: null },
    ));
    await act(async () => root.render(<SellerSession />));
    const accounts = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Accounts'));
    expect(accounts).toBeDefined();
    await act(async () => accounts?.click());
    const env = container.querySelector<HTMLSelectElement>('[aria-label="Pathao courier settings"] select')!;
    await act(async () => { env.value = 'sandbox'; env.dispatchEvent(new Event('change', { bubbles: true })); });
    const password = container.querySelector<HTMLInputElement>('[name="password"]')!;
    password.value = 'unfinished-synthetic-password';
    password.focus();
    clerk.getToken.mockResolvedValue('renewed-session-token');
    await act(async () => vi.advanceTimersByTimeAsync(60000));
    expect(container.querySelector('[name="password"]')).toBe(password);
    expect(password.value).toBe('unfinished-synthetic-password');
    expect(document.activeElement).toBe(password);
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Pathao courier settings"] select')?.value).toBe('sandbox');
    const reload = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Reload settings');
    await act(async () => reload?.click());
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/courier/pathao/sandbox'), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer renewed-session-token' }),
    }));
  } finally { vi.useRealTimers(); }
});
it('keeps the language switch available while sign-in loads without requesting a token', async () => {
  localStorage.setItem('middleman.locale', 'en');
  clerk.isLoaded = false;
  await act(async () => root.render(<SellerSession />));
  await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'বাংলা')!.click());
  expect(container.querySelector('[role=status]:not(.sr-only)')?.textContent).toContain('সাইন ইন লোড হচ্ছে');
  expect(clerk.getToken).not.toHaveBeenCalled();
  localStorage.clear();
});
it('shares the enclosing locale selection without reacquiring the seller token', async () => {
  localStorage.setItem('middleman.locale', 'en');
  function OuterLocale(): React.JSX.Element {
    const { locale } = useLocale();
    return <span data-testid="outer-locale">{locale}</span>;
  }
  try {
    await act(async () => root.render(
      <LocaleProvider>
        <OuterLocale />
        <SellerSession />
      </LocaleProvider>,
    ));
    expect(container.textContent).toContain('Shop Setup');
    const tokens = clerk.getToken.mock.calls.length;

    await act(async () => Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent === 'বাংলা')!.click());

    expect(container.querySelector('[data-testid="outer-locale"]')?.textContent).toBe('bn');
    expect(container.textContent).toContain(sellerCopy.bn.setup);
    expect(clerk.getToken).toHaveBeenCalledTimes(tokens);
  } finally { localStorage.clear(); }
});
it('translates a rejected session without repeating authentication or requests', async () => {
  localStorage.setItem('middleman.locale', 'en');
  vi.mocked(fetch).mockImplementation(async (url) => String(url).includes('/seller/')
    ? new Response('{}', { status: 401, headers: { 'X-Seller-Auth-Reason': 'not_yet_valid' } })
    : Response.json({ status: 'healthy' }));
  try {
    await act(async () => root.render(<SellerSession />));
    expect(container.textContent).toContain('Session diagnostic: not_yet_valid');
    const calls = vi.mocked(fetch).mock.calls.length;
    const tokens = clerk.getToken.mock.calls.length;
    const button = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'বাংলা')!;
    button.focus();
    await act(async () => button.click());
    expect(container.textContent).toContain('এখনও কার্যকর নয়');
    expect(document.activeElement).toBe(button);
    expect(fetch).toHaveBeenCalledTimes(calls);
    expect(clerk.getToken).toHaveBeenCalledTimes(tokens);
  } finally { localStorage.clear(); }
});
