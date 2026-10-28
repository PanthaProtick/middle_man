import type { PublicOrder } from './types';

export const awaitingOrder: PublicOrder = {
  id: 'order-1',
  shop_display_name: 'Smart Gadget Shop',
  product_name: 'Wireless Bluetooth Earbuds',
  total_minor: 350000,
  required_advance_minor: 50000,
  expected_cod_minor: 300000,
  actual_cod_minor: null,
  account_provider: 'bkash',
  account_receiving_number: '01712345678',
  account_label: 'Shop Official bKash',
  lifecycle: 'awaiting_buyer',
  status_message: 'Please review and submit payment details.',
  submission_acknowledgement: null,
  created_at: '2026-10-23T12:00:00Z',
  expires_at: '2026-10-25T12:00:00Z',
  completed_at: null,
  ai_assistance_available: false,
};

export function findLanguageButton(container: HTMLElement, name: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button'))
    .find((candidate) => candidate.textContent === name);
  if (!button) throw new Error(`Missing language button ${name}`);
  return button;
}

export function buyerSummaryCard(container: HTMLElement): HTMLElement {
  const card = container.querySelector<HTMLElement>('.card');
  if (!card) throw new Error('Missing buyer summary card');
  return card;
}
