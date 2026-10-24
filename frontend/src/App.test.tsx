import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./features/seller', () => ({ SellerWorkspace: () => <div>Seller desk</div> }));
vi.mock('./features/buyer', () => ({ BuyerPortal: () => <div>Buyer confirmation</div> }));
vi.mock('./features/demo', () => ({ DemoTools: () => <div>Diagnostic tools</div> }));
vi.mock('./services/api', () => ({ fetchHealth: vi.fn().mockResolvedValue({ status: 'healthy' }) }));
import { fetchHealth } from './services/api';

describe('Application workflow shell', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    window.history.replaceState({}, '', '/');
  });
  it('keeps diagnostics secondary and allows returning to the shop', async () => {
    await act(async () => root.render(<App />));
    expect(container.textContent).toContain('Seller desk');
    expect(container.querySelectorAll('[role="tablist"]')).toHaveLength(0);
    const demo = Array.from(container.querySelectorAll('button')).find(button => button.textContent?.includes('Demo & tools'));
    expect(demo).toBeDefined();
    await act(async () => demo?.click());
    expect(container.textContent).toContain('Diagnostic tools');
    expect(container.textContent).not.toContain('Seller desk');
    const back = Array.from(container.querySelectorAll('button')).find(button => button.textContent?.includes('Back to shop'));
    await act(async () => back?.click());
    expect(container.textContent).toContain('Seller desk');
    expect(container.querySelector('.skip-link')?.getAttribute('href')).toBe('#workspace');
  });
  it('shows the focused buyer portal without seller health polling', async () => {
    window.history.replaceState({}, '', '/orders/synthetic');
    await act(async () => root.render(<App />));
    expect(container.textContent).toContain('Buyer confirmation');
    expect(container.textContent).toContain('Never share your PIN or OTP');
    expect(container.textContent).not.toContain('Seller desk');
    expect(fetchHealth).not.toHaveBeenCalled();
    expect(container.querySelector('a[referrerpolicy="no-referrer"]')?.getAttribute('href')).toBe('/?order-link=synthetic');
  });
});
