import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Header from '../Header';
import { LocaleProvider } from '../../features/locale';
import type { HealthStatus } from '../../services/api';

const mockHealth: HealthStatus = {
  status: 'healthy',
  project_name: 'Middleman API',
  environment: 'test',
  database_configured: true,
  gemini_configured: true,
};

describe('Header component', () => {
  let host: HTMLDivElement;

  function render(ui: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(ui);
    });
    return {
      host,
      root,
      unmount: () => act(() => root.unmount()),
    };
  }

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders project name and Built for AIgnite 2026 sticker in navbar', () => {
    const { host, unmount } = render(
      <LocaleProvider>
        <Header health={mockHealth} />
      </LocaleProvider>,
    );

    const heading = host.querySelector('h1');
    expect(heading?.textContent).toBe('Middleman');

    const sticker = host.querySelector<HTMLImageElement>('img.brand-sticker');
    expect(sticker).not.toBeNull();
    expect(sticker?.getAttribute('alt')).toBe('Built for AIgnite 2026');
    expect(sticker?.getAttribute('src')).toBeTruthy();

    unmount();
  });

  it('renders sign out button when authenticated with handler', () => {
    const onSignOut = vi.fn();
    const { host, unmount } = render(
      <LocaleProvider>
        <Header
          health={mockHealth}
          isAuthenticated
          onSignOut={onSignOut}
        />
      </LocaleProvider>,
    );

    const signOutBtn = host.querySelector<HTMLButtonElement>('.header-action-btn');
    expect(signOutBtn).not.toBeNull();
    act(() => {
      signOutBtn?.click();
    });
    expect(onSignOut).toHaveBeenCalledOnce();

    unmount();
  });
});
