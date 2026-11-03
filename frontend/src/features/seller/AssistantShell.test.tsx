import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { AssistantWorkspace } from './AssistantWorkspace';

it('posts with Enter, preserves Shift+Enter, and traps keyboard focus in the shell', async () => {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<AssistantWorkspace floating><p>Orders</p></AssistantWorkspace>));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="seller-assistant-launcher"]')!.click());
    const input = host.querySelector<HTMLTextAreaElement>('textarea')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Hello');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true })));
    expect(host.querySelector('[role="log"]')?.textContent).not.toContain('Hello');
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
    expect(host.querySelector('[role="log"]')?.textContent).toContain('Hello');
    expect(host.querySelector('[role="log"] time')).not.toBeNull();
    const panel = host.querySelector<HTMLElement>('.seller-assistant-window')!;
    const buttons = panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
    input.focus();
    await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(buttons[0]);
  } finally { await act(async () => root.unmount()); host.remove(); }
});

