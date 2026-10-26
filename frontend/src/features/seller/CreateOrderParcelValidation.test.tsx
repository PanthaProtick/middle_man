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

function input(name: string): HTMLInputElement {
  return container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
}

function enter(name: string, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(name), value);
  input(name).dispatchEvent(new Event('input', { bubbles: true }));
}

function submit() {
  container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

it('announces and associates parcel errors, focuses the first error, and preserves other entries', async () => {
  document.body.append(container);
  root = createRoot(container);
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await act(async () => root.render(<CreateOrderModal accounts={[account]} onClose={vi.fn()}
    onOrderCreated={vi.fn()} onError={vi.fn()} />));
  await act(async () => {
    enter('productName', 'Test parcel'); enter('totalBdt', '1000'); enter('advanceBdt', '100');
    // Valid native number notation that the parcel contract deliberately rejects.
    enter('parcelWeightKg', '1e0'); enter('parcelQuantity', '2e0');
  });
  await act(async () => submit());
  for (const name of ['parcelWeightKg', 'parcelQuantity']) {
    const field = input(name);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    const descriptions = field.getAttribute('aria-describedby')!.split(' ');
    expect(descriptions).toContain('parcel-early-hint');
    const error = descriptions.map(id => document.getElementById(id))
      .find(element => element?.getAttribute('role') === 'alert');
    expect(error?.textContent).toContain(name === 'parcelWeightKg' ? 'Parcel weight' : 'Parcel quantity');
  }
  expect(document.activeElement).toBe(input('parcelWeightKg'));
  expect(input('parcelQuantity').value).toBe('2e0');
  expect(input('productName').value).toBe('Test parcel');
  expect(fetcher).not.toHaveBeenCalled();

  await act(async () => enter('parcelWeightKg', '1.5'));
  expect(input('parcelWeightKg').getAttribute('aria-invalid')).not.toBe('true');
  expect(input('parcelQuantity').getAttribute('aria-invalid')).toBe('true');
  expect(document.activeElement).toBe(input('parcelWeightKg'));
  await act(async () => submit());
  expect(document.activeElement).toBe(input('parcelQuantity'));

  await act(async () => enter('parcelQuantity', '2'));
  expect(container.querySelector('[role="alert"]')).toBeNull();
  fetcher.mockResolvedValue(new Response(JSON.stringify({ id: 'new-order' }), { status: 201 }));
  await act(async () => submit());
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
    product_name: 'Test parcel', parcel_weight_grams: 1500, parcel_quantity: 2,
  });
});
