import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SellerSession } from './SellerSession';

const clerk = vi.hoisted(() => ({
  getToken: vi.fn(), openSignIn: vi.fn(), signOut: vi.fn(),
  sessionId: 'session-alpha' as string | null, isSignedIn: true,
}));
vi.mock('@clerk/react', () => ({
  useAuth: () => ({ ...clerk, isLoaded: true }),
  useClerk: () => clerk,
}));
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  clerk.sessionId = 'session-alpha';
  clerk.isSignedIn = true;
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
  expect(clerk.openSignIn).toHaveBeenCalled();
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

it('clears private content when periodic token acquisition fails', async () => {
  vi.useFakeTimers();
  try {
    await act(async () => root.render(<SellerSession />));
    expect(container.textContent).toContain('Shop Setup');
    clerk.getToken.mockResolvedValue(null);
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(container.textContent).not.toContain('Shop Setup');
    expect(container.textContent).toContain('Unable to obtain your seller session');
  } finally { vi.useRealTimers(); }
});
