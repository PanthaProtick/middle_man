import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceSectionNav } from './WorkspaceSectionNav';
import { LocaleProvider } from '../locale';

describe('WorkspaceSectionNav', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders exactly 3 top tabs and activates only one tab at a time', async () => {
    const root = createRoot(container);
    const onSelectSection = vi.fn();

    await act(async () => {
      root.render(
        <LocaleProvider>
          <WorkspaceSectionNav
            currentSection="orders"
            onSelectSection={onSelectSection}
            ordersCount={3}
            transactionsCount={1}
            accountsCount={0}
          />
        </LocaleProvider>
      );
    });

    const topTabs = container.querySelectorAll('.workspace-section-tab');
    expect(topTabs).toHaveLength(3);

    const activeTopTabs = container.querySelectorAll('.workspace-section-tab.active');
    expect(activeTopTabs).toHaveLength(1);
    expect(topTabs[0].getAttribute('aria-current')).toBe('page');
    expect(topTabs[1].getAttribute('aria-current')).toBeNull();
    expect(topTabs[2].getAttribute('aria-current')).toBeNull();

    // Badges
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('1');

    await act(async () => root.unmount());
  });

  it('activates settings rail tab and subnav tab without duplication when on retention', async () => {
    const root = createRoot(container);
    const onSelectSection = vi.fn();
    const onSelectSub = vi.fn();

    await act(async () => {
      root.render(
        <LocaleProvider>
          <WorkspaceSectionNav
            currentSection="retention"
            onSelectSection={onSelectSection}
            ordersCount={0}
            transactionsCount={0}
            accountsCount={0}
            activeSettingsSub="retention"
            onSelectSettingsSub={onSelectSub}
          />
        </LocaleProvider>
      );
    });

    const topTabs = container.querySelectorAll('.workspace-section-tab');
    expect(topTabs).toHaveLength(3);

    // Exactly one top tab has aria-current="page"
    const currentTabs = container.querySelectorAll('.workspace-section-tab[aria-current="page"]');
    expect(currentTabs).toHaveLength(1);
    expect(topTabs[2].classList.contains('active')).toBe(true);

    // Subnav tabs are rendered
    const subTabs = container.querySelectorAll('.workspace-subnav-tab');
    expect(subTabs).toHaveLength(3);

    // Retention sub-tab is active
    const retentionSubTab = Array.from(subTabs).find((t) => t.textContent?.includes('Retention'));
    expect(retentionSubTab?.getAttribute('aria-selected')).toBe('true');
    expect(retentionSubTab?.classList.contains('active')).toBe(true);

    // Clicking Courier sub-tab calls onSelectSettingsSub
    const courierSubTab = Array.from(subTabs).find((t) => t.textContent?.includes('Courier'));
    await act(async () => {
      (courierSubTab as HTMLButtonElement)?.click();
    });
    expect(onSelectSub).toHaveBeenCalledWith('courier');

    await act(async () => root.unmount());
  });
});
