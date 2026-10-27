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

  it('renders provider select and inputs with accessible labels and options', () => {
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

    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Payment provider"]');
    expect(select).not.toBeNull();
    expect(select?.value).toBe('bkash');
    const options = Array.from(select?.options ?? []).map((o) => ({ value: o.value, text: o.text }));
    expect(options).toEqual([
      { value: 'bkash', text: 'bKash' },
      { value: 'nagad', text: 'Nagad' },
    ]);

    const receivingInput = container.querySelector<HTMLInputElement>('input[aria-label="Receiving number"]');
    expect(receivingInput).not.toBeNull();
    expect(receivingInput?.placeholder).toContain('Receiving Number');

    const labelInput = container.querySelector<HTMLInputElement>('input[aria-label="Account label"]');
    expect(labelInput).not.toBeNull();
    expect(labelInput?.placeholder).toContain('Label');

    const submitButton = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submitButton).not.toBeNull();
    expect(submitButton?.textContent).toContain('Add Account');
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

    const receivingInput = container.querySelector<HTMLInputElement>('input[aria-label="Receiving number"]')!;
    const labelInput = container.querySelector<HTMLInputElement>('input[aria-label="Account label"]')!;
    const form = container.querySelector('form');

    act(() => {
      setInputValue(receivingInput, '01700000001');
      setInputValue(labelInput, 'Main bKash');
    });

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(onAccountCreated).toHaveBeenCalledWith(mockCreated);
    expect(onError).toHaveBeenCalledWith(null);
  });
});
