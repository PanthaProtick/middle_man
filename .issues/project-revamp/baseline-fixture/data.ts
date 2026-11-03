import type { PaymentAccount, SellerOrder, ReceiptView } from '../../../frontend/src/features/seller/types';
import type { PublicOrder } from '../../../frontend/src/features/buyer/types';

export const timestamp = '2026-11-02T06:00:00Z';
export const account: PaymentAccount = {
  id: 'baseline-account', shop_id: 'baseline-shop', provider: 'bkash',
  receiving_number: '01700000000', label: 'Synthetic receiving account',
  is_active: true, version: 1, created_at: timestamp, updated_at: timestamp,
};
const lifecycles: SellerOrder['lifecycle'][] = ['awaiting_buyer', 'pending', 'confirmed'];
export const orders: SellerOrder[] = lifecycles.map((lifecycle, index) => ({
  id: `baseline-order-${index}`, shop_id: account.shop_id, payment_account_id: account.id,
  product_name: ['Cotton panjabi / সুতি পাঞ্জাবি', 'হাতে তৈরি নকশিকাঁথা — special gift package', 'Canvas everyday bag'][index],
  total_minor: 250000, required_advance_minor: 50000, expected_cod_minor: 200000,
  actual_cod_minor: index === 2 ? 200000 : null, account_provider: 'bkash',
  account_receiving_number: account.receiving_number, account_label: account.label,
  lifecycle, version: 1, parcel_weight_grams: index === 2 ? 1200 : null, parcel_quantity: index === 2 ? 2 : null,
  review_reasons: index === 1 ? ['AMOUNT_MISMATCH'] : [], buyer_revision: index ? 1 : null,
  allocation_basis: index === 2 ? 'automatic' : null, delivery_staged: index === 2,
  portal_token: `synthetic-${index}`, portal_url: `/orders/synthetic-${index}`,
  created_at: timestamp, updated_at: timestamp, expires_at: '2026-12-02T06:00:00Z', completed_at: null,
}));
export const receipt: ReceiptView = {
  id: 'baseline-receipt', shop_id: account.shop_id, payment_account_id: account.id,
  provider: 'bkash', trx_id: 'SYNTHETIC01', amount_minor: 50000,
  sender_number_raw: '01900000000', sender_number_canonical: '01900000000',
  occurred_at: timestamp, reconciliation_state: 'unmatched', has_conflict: false,
  version: 1, created_at: timestamp, updated_at: timestamp, observations: [], related_claims_count: 0,
};
export const publicOrder: PublicOrder = {
  id: orders[0].id, shop_display_name: 'Synthetic shop / পরীক্ষামূলক দোকান',
  product_name: orders[0].product_name, total_minor: 250000, required_advance_minor: 50000,
  expected_cod_minor: 200000, actual_cod_minor: null, account_provider: 'bkash',
  account_receiving_number: account.receiving_number, account_label: account.label,
  lifecycle: 'awaiting_buyer', status_message: 'Please review and submit payment details.',
  submission_acknowledgement: null, created_at: timestamp, expires_at: orders[0].expires_at,
  completed_at: null,
};
