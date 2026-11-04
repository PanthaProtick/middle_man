import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AssistantAccountSelect } from './AssistantAccountSelect';
import type { PaymentAccount } from './types';

let root: Root;
let host: HTMLDivElement;
const account: PaymentAccount = {
  id: 'active', shop_id: 'shop', provider: 'bkash', receiving_number: '01700000001',
  label: 'Synthetic receiving account A with a very long label', is_active: true,
  version: 1, created_at: '', updated_at: '',
};
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

async function mount(value: string, disabled = false) {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  const onChange = vi.fn();
  await act(async () => root.render(<AssistantAccountSelect accounts={[account,
    { ...account, id: 'inactive', is_active: false }]} label="Receiving account"
    placeholder="Choose an active account" name="account" value={value}
    disabled={disabled} invalid={!value} onChange={onChange} />));
  return { select: host.querySelector('select')!, onChange };
}

it('keeps options compact and exposes the full selected identity as wrapping description', async () => {
  const { select } = await mount('active');
  expect(select.options[1].textContent).toBe('bkash · 01700000001');
  expect(select.options).toHaveLength(2);
  const description = document.getElementById(select.getAttribute('aria-describedby')!);
  expect(description?.textContent).toBe(`${account.label} · bkash · 01700000001`);
  expect(select.labels?.[0].textContent).toBe('Receiving account');
});

it('preserves placeholder validation and reports the selected account ID', async () => {
  const { select, onChange } = await mount('');
  expect(select.getAttribute('aria-invalid')).toBe('true');
  expect(select.hasAttribute('aria-describedby')).toBe(false);
  await act(async () => {
    select.value = 'active'; select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(onChange).toHaveBeenCalledWith('active');
});

it('disables the selector during locked submissions', async () => {
  const { select } = await mount('active', true);
  expect(select.disabled).toBe(true);
});
