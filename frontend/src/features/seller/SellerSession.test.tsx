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
