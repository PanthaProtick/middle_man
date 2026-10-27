import { afterEach, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CreateOrderModal } from './CreateOrderModal';
import type { PaymentAccount } from './types';

const account: PaymentAccount = {
  id: 'account', shop_id: 'shop', provider: 'bkash', receiving_number: '01711223344',
  label: 'Test account', is_active: true, version: 1, created_at: '', updated_at: '',
};
const container = document.createElement('div');
let root: ReturnType<typeof createRoot>;

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function getFieldByAccessibleLabel(labelPattern: string): HTMLInputElement {
  const ariaInput = container.querySelector<HTMLInputElement>(`input[aria-label="${labelPattern}"]`);
  if (ariaInput) return ariaInput;

  const label = Array.from(container.querySelectorAll('label')).find((l) =>
    l.textContent?.includes(labelPattern)
  );
  if (label) {
    const id = label.htmlFor || label.getAttribute('for');
    if (id) {
      const el = container.querySelector<HTMLInputElement>(`#${id}`);
      if (el) return el;
    }
    const nested = label.querySelector('input');
    if (nested) return nested;
  }
  return container.querySelector<HTMLInputElement>(`input[name="${labelPattern}"]`)!;
}

function enter(field: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

function submit() {
  const submitButton = container.querySelector<HTMLButtonElement>('button[type="submit"]');
  expect(submitButton).not.toBeNull();
  expect(submitButton?.textContent).toContain('Generate Buyer Link');
  const form = submitButton?.closest('form') ?? container.querySelector('form');
  form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

it('announces and associates parcel errors, focuses the first error, and preserves other entries', async () => {
  document.body.append(container);
  root = createRoot(container);
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await act(async () => root.render(<CreateOrderModal accounts={[account]} onClose={vi.fn()}
    onOrderCreated={vi.fn()} onError={vi.fn()} />));

  const productField = getFieldByAccessibleLabel('Product Name / Agreed Items');
  const totalField = getFieldByAccessibleLabel('Total Agreed Price (BDT)');
  const advanceField = getFieldByAccessibleLabel('Required Advance (BDT)');
  const weightField = getFieldByAccessibleLabel('Weight (kg)');
  const quantityField = getFieldByAccessibleLabel('Quantity');

  await act(async () => {
    enter(productField, 'Test parcel');
    enter(totalField, '1000');
    enter(advanceField, '100');
    // Valid native number notation that the parcel contract deliberately rejects.
    enter(weightField, '1e0');
    enter(quantityField, '2e0');
  });
  await act(async () => submit());

  for (const field of [weightField, quantityField]) {
    expect(field.getAttribute('aria-invalid')).toBe('true');
    const descriptions = field.getAttribute('aria-describedby')!.split(' ');
    expect(descriptions).toContain('parcel-early-hint');
    const errorAlert = descriptions
      .map(id => document.getElementById(id))
      .find(element => element?.getAttribute('role') === 'alert');
    expect(errorAlert).toBeDefined();
    expect(errorAlert?.textContent).toMatch(/Parcel (weight|quantity)/);
  }

  const alerts = Array.from(container.querySelectorAll<HTMLElement>('[role="alert"]'));
  expect(alerts.some(a => a.textContent?.includes('Parcel weight'))).toBe(true);
  expect(alerts.some(a => a.textContent?.includes('Parcel quantity'))).toBe(true);

  expect(document.activeElement).toBe(weightField);
  expect(quantityField.value).toBe('2e0');
  expect(productField.value).toBe('Test parcel');
  expect(fetcher).not.toHaveBeenCalled();

  await act(async () => enter(weightField, '1.5'));
  expect(weightField.getAttribute('aria-invalid')).not.toBe('true');
  expect(quantityField.getAttribute('aria-invalid')).toBe('true');
  expect(document.activeElement).toBe(weightField);

  await act(async () => submit());
  expect(document.activeElement).toBe(quantityField);

  await act(async () => enter(quantityField, '2'));
  expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0);

  fetcher.mockResolvedValue(new Response(JSON.stringify({ id: 'new-order' }), { status: 201 }));
  await act(async () => submit());
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
    product_name: 'Test parcel', parcel_weight_grams: 1500, parcel_quantity: 2,
  });
});
