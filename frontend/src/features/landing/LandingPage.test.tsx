import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingPage } from './LandingPage';
import { LocaleProvider, useLocale } from '../locale';

function TestWrapper({
  locale = 'en',
  onSignIn,
  children,
}: {
  locale?: 'en' | 'bn';
  onSignIn?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <LocaleProvider>
      <LocaleSetter targetLocale={locale}>
        <LandingPage onSignIn={onSignIn}>{children}</LandingPage>
      </LocaleSetter>
    </LocaleProvider>
  );
}

function LocaleSetter({
  targetLocale,
  children,
}: {
  targetLocale: 'en' | 'bn';
  children: React.ReactNode;
}) {
  const { locale, setLocale } = useLocale();
  useEffect(() => {
    if (locale !== targetLocale) {
      setLocale(targetLocale);
    }
  }, [locale, targetLocale, setLocale]);
  return <>{children}</>;
}

describe('LandingPage surface', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('renders English hero, value proposition, and trust badge by default', async () => {
    await act(async () => {
      root.render(<TestWrapper />);
    });

    expect(container.textContent).toContain('Collect delivery advances in chat');
    expect(container.textContent).toContain('stop fake orders before shipping');
    expect(container.textContent).toContain('Middleman turns agreed social-commerce sales');
    expect(container.textContent).toContain('Start Shop Desk');
    expect(container.textContent).toContain('Zero courier return losses');
  });

  it('switches to authentic Bengali when locale is bn', async () => {
    await act(async () => {
      root.render(<TestWrapper locale="bn" />);
    });

    expect(container.textContent).toContain('চ্যাটেই ডেলিভারি অগ্রিম নিশ্চিত করুন');
    expect(container.textContent).toContain('ভুয়া অর্ডার রোধ করে নিশ্চিন্তে কুরিয়ার পাঠান');
    expect(container.textContent).toContain('শপ ডেস্ক শুরু করুন');
    expect(container.textContent).toContain('ধাপ ১');
    expect(container.textContent).toContain('চ্যাটে কথা ও লিংক প্রদান');
  });

  it('navigates through interactive product tour steps', async () => {
    await act(async () => {
      root.render(<TestWrapper />);
    });

    // Starts on Step 1: Chat
    expect(container.textContent).toContain('Agree in Chat & Share Link');
    expect(container.textContent).toContain('middleman.app/orders/dh-8492');

    // Click on Step 2 tab: Buyer Portal
    const stepTabs = container.querySelectorAll<HTMLButtonElement>('.step-tab');
    expect(stepTabs.length).toBe(4);

    await act(async () => {
      stepTabs[1].click();
    });
    expect(container.textContent).toContain('Buyer Reviews & Pays Advance');
    expect(container.textContent).toContain('Total Bill:');
    expect(container.textContent).toContain('Required Advance:');

    // Click on Step 3 tab: Reconciliation Desk
    await act(async () => {
      stepTabs[2].click();
    });
    expect(container.textContent).toContain('Reconcile on Shop Desk');
    expect(container.textContent).toContain('Shop Desk Inbox');
    expect(container.textContent).toContain('bKash Merchant SMS');

    // Click on Step 4 tab: Courier Handoff
    await act(async () => {
      stepTabs[3].click();
    });
    expect(container.textContent).toContain('1-Tap Pathao Dispatch');
    expect(container.textContent).toContain('Pathao Courier Preparation');
    expect(container.textContent).toContain('Stage Parcel in Pathao');
  });

  it('invokes onSignIn callback when primary or footer CTA is clicked', async () => {
    const onSignIn = vi.fn();
    await act(async () => {
      root.render(<TestWrapper onSignIn={onSignIn} />);
    });

    const ctaButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).filter(
      (btn) =>
        btn.textContent?.includes('Start Shop Desk') ||
        btn.textContent?.includes('Create Your Shop Desk'),
    );
    expect(ctaButtons.length).toBeGreaterThanOrEqual(2);

    await act(async () => {
      ctaButtons[0].click();
    });
    expect(onSignIn).toHaveBeenCalledTimes(1);

    await act(async () => {
      ctaButtons[1].click();
    });
    expect(onSignIn).toHaveBeenCalledTimes(2);
  });

  it('renders embedded child workspace preview and preserves skip-link anchor target', async () => {
    await act(async () => {
      root.render(
        <TestWrapper>
          <div data-testid="test-desk">Interactive Desk Standby</div>
        </TestWrapper>,
      );
    });

    const previewSection = container.querySelector('#workspace');
    expect(previewSection).not.toBeNull();
    expect(container.querySelector('[data-testid="test-desk"]')).not.toBeNull();
    expect(container.textContent).toContain('Interactive Desk Standby');
  });
});
