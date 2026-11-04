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

    expect(container.querySelector('h1')?.textContent).toBe(
      'You put heart into your shop. Keep every order together.',
    );
    expect(container.querySelector('.hero-lead')?.textContent).toContain(
      'match bKash or Nagad advances with their payment records',
    );
    expect(container.textContent).toContain('Start Shop Desk');
    expect(container.querySelector('.hero-trust-bar')?.textContent).toContain(
      'For Bangladesh’s Facebook shops, in বাংলা and English.',
    );
  });

  it('switches to authentic Bengali when locale is bn', async () => {
    await act(async () => {
      root.render(<TestWrapper locale="bn" />);
    });

    expect(container.querySelector('h1')?.textContent).toBe(
      'যত্নে গড়ে তোলা আপনার ব্যবসা। অর্ডারের খুঁটিনাটি থাকুক এক জায়গায়।',
    );
    expect(container.querySelector('.hero-lead')?.textContent).toContain(
      'নিজের পেমেন্ট রেকর্ডের সঙ্গে বিকাশ বা নগদের অগ্রিম মেলানো',
    );
    expect(container.querySelector('.hero-trust-bar')?.textContent).toContain(
      'বাংলাদেশের ফেসবুক ব্যবসার জন্য, বাংলা ও ইংরেজিতে।',
    );
    expect(container.textContent).toContain('শপ ডেস্ক শুরু করুন');
    expect(container.textContent).toContain('ধাপ ১');
    expect(container.textContent).toContain('চ্যাটে কথা ও লিংক প্রদান');
    expect(container.textContent).toContain('মধ্যস্বত্ব শপ ডেস্ক');
    expect(container.textContent).toContain('ঢাকা শপ অপারেশন সক্রিয়');
    await act(async () => {
      container.querySelectorAll<HTMLButtonElement>('.showcase-tab')[1].click();
      container.querySelectorAll<HTMLButtonElement>('.step-tab')[2].click();
    });
    expect(container.textContent).toContain('বিক্রেতার পেমেন্ট রেকর্ডের সাথে মিল পাওয়া গেছে');
    expect(container.textContent).not.toContain('এসএমএস');

  });

  it('renders hero showcase asset on right side introducing Middleman', async () => {
    await act(async () => {
      root.render(<TestWrapper />);
    });

    const showcase = container.querySelector('[data-testid="hero-showcase"]');
    expect(showcase).not.toBeNull();
    expect(showcase?.textContent).toContain('Middleman Shop Desk');
    expect(showcase?.textContent).toContain('Dhaka Operations Active');
    expect(showcase?.textContent).toContain('1. Buyer Link');
    expect(showcase?.textContent).toContain('2. Payment Match');
    expect(showcase?.textContent).toContain('3. Pathao Dispatch');
    expect(showcase?.textContent).toContain('Dhaka Handloom Jamdani Saree');
    expect(showcase?.textContent).toContain('middleman.app/orders/dh-8492');

    // Switch to step 2: Payment Match
    const tabs = showcase?.querySelectorAll<HTMLButtonElement>('.showcase-tab');
    expect(tabs?.length).toBe(3);

    await act(async () => {
      tabs?.[1].click();
    });
    expect(showcase?.textContent).toContain('Two-way bKash & Nagad reconciliation');
    expect(showcase?.textContent).toContain('Claimed TrxID');
    expect(showcase?.textContent).toContain('BL9X4M291Q');
    expect(showcase?.textContent).toContain('Advance Accepted');

    // Switch to step 3: Pathao Dispatch
    await act(async () => {
      tabs?.[2].click();
    });
    expect(showcase?.textContent).toContain('Prepare a Pathao handoff with remaining COD');
    expect(showcase?.textContent).toContain('Consignment #PATHAO-8492');
    expect(showcase?.textContent).toContain('Remaining COD');
    expect(showcase?.textContent).toContain('৳3,050');
    expect(showcase?.textContent).toContain('Ready for Pickup');
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
    expect(container.textContent).toContain('Seller payment record');

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
