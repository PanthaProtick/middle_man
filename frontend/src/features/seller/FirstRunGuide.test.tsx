import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FirstRunGuide } from './FirstRunGuide';
import { LocaleProvider } from '../locale';

describe('FirstRunGuide', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders expanded by default for new shops without accounts or orders', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <LocaleProvider>
          <FirstRunGuide hasAccounts={false} hasOrders={false} hasCourier={false} />
        </LocaleProvider>
      );
    });

    expect(container.textContent).toContain('Getting Started');
    expect(container.textContent).toContain('Add receiving account');
    expect(container.textContent).toContain('Create first order link');
    expect(container.textContent).toContain('Connect Pathao courier');

    // Toggle button should be present and allow collapsing
    const toggleBtn = container.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');
    expect(toggleBtn).not.toBeNull();
    await act(async () => {
      toggleBtn?.click();
    });
    expect(toggleBtn?.getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).not.toContain('Add receiving account');

    await act(async () => root.unmount());
  });

  it('auto-collapses when work is started and navigates to steps', async () => {
    const root = createRoot(container);
    const onNavigateAccounts = vi.fn();
    const onCreateOrder = vi.fn();
    const onNavigateCourier = vi.fn();

    await act(async () => {
      root.render(
        <LocaleProvider>
          <FirstRunGuide
            hasAccounts={true}
            hasOrders={false}
            hasCourier={false}
            onNavigateToAccounts={onNavigateAccounts}
            onOpenCreateOrder={onCreateOrder}
            onNavigateToCourier={onNavigateCourier}
          />
        </LocaleProvider>
      );
    });

    // Auto-collapsed: steps are hidden
    expect(container.textContent).toContain('Getting Started');
    expect(container.textContent).not.toContain('Create first order link');

    // Expand
    const toggleBtn = container.querySelector<HTMLButtonElement>('button[aria-expanded="false"]');
    expect(toggleBtn).not.toBeNull();
    await act(async () => {
      toggleBtn?.click();
    });
    expect(container.textContent).toContain('Create first order link');

    // Step 2 button triggers create order
    const step2Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Create first order link')
    );
    expect(step2Btn).toBeDefined();
    await act(async () => {
      step2Btn?.click();
    });
    expect(onCreateOrder).toHaveBeenCalledTimes(1);

    // Step 3 button triggers courier
    const step3Btn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Connect Pathao courier')
    );
    expect(step3Btn).toBeDefined();
    await act(async () => {
      step3Btn?.click();
    });
    expect(onNavigateCourier).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
  });

  it('can be dismissed with the close button', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <LocaleProvider>
          <FirstRunGuide hasAccounts={false} hasOrders={false} hasCourier={false} />
        </LocaleProvider>
      );
    });

    expect(container.textContent).toContain('Getting Started');
    const dismissBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]');
    expect(dismissBtn).not.toBeNull();
    await act(async () => {
      dismissBtn?.click();
    });

    expect(container.querySelector('.first-run-guide')).toBeNull();
    await act(async () => root.unmount());
  });
});
