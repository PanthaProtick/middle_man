import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AddAccountForm } from './AddAccountForm';
import * as api from './api';

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('AddAccountForm', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.restoreAllMocks();
  });

  it('renders provider select and receiving number input with proper styles and placeholders', () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <AddAccountForm
          token="test-token"
          onAccountCreated={vi.fn()}
          onError={vi.fn()}
        />,
      );
    });

    const select = container.querySelector('select');
    expect(select).not.toBeNull();
    expect(select?.value).toBe('bkash');
    expect(select?.style.width).toBe('120px');

    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBe(2);

    const receivingInput = inputs[0];
    expect(receivingInput.placeholder).toContain('Receiving Number');
    expect(receivingInput.style.flexGrow).toBe('1');

    const labelInput = inputs[1];
    expect(labelInput.placeholder).toContain('Label');
  });

  it('submits form successfully when valid data is entered', async () => {
    const mockCreated = {
      id: 'acc-new',
      shop_id: 'shop-1',
      provider: 'bkash' as const,
      receiving_number: '+8801700000001',
      label: 'Main bKash',
      is_active: true,
      version: 1,
      created_at: '',
      updated_at: '',
    };
    vi.spyOn(api, 'createPaymentAccount').mockResolvedValue(mockCreated);

    const onAccountCreated = vi.fn();
    const onError = vi.fn();
    const root = createRoot(container);

    act(() => {
      root.render(
        <AddAccountForm
          token="test-token"
          onAccountCreated={onAccountCreated}
          onError={onError}
        />,
      );
    });

    const inputs = container.querySelectorAll('input');
    const form = container.querySelector('form');

    act(() => {
      setInputValue(inputs[0], '01700000001');
      setInputValue(inputs[1], 'Main bKash');
    });

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(onAccountCreated).toHaveBeenCalledWith(mockCreated);
    expect(onError).toHaveBeenCalledWith(null);
  });
});
