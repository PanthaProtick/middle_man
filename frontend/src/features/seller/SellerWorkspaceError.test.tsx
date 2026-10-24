import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { SellerWorkspace } from './SellerWorkspace';

describe('SellerWorkspace Error Handling', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.restoreAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders explicit error alert when shop creation fails with 503 durable storage unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      const urlStr = String(url);
      const method = (init as RequestInit | undefined)?.method || 'GET';
      if (urlStr.includes('/seller/shop') && method === 'GET') {
        return Promise.resolve(
          new Response(
            JSON.stringify({ shop: null, setup_needed: true }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (urlStr.includes('/seller/shop') && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: 'DURABLE_STORAGE_UNAVAILABLE',
                message: 'Durable storage is required in integration mode: Database configuration is missing.',
              },
              detail: 'Durable storage is required in integration mode.',
            }),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(SellerWorkspace, { token: 'mock-seller-token' }));
    });

    expect(container.textContent).toContain('Shop Setup');
    const input = container.querySelector('input#shop-display-name') as HTMLInputElement;
    expect(input).toBeDefined();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      nativeSetter?.call(input, 'My New Shop');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const form = container.querySelector('form');
    expect(form).toBeDefined();
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    const alert = container.querySelector('div[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain(
      'Durable storage is required in integration mode: Database configuration is missing.',
    );
  });
});
