import type { Revision } from '../../../frontend/src/features/seller/corrections';
import type { PaymentPreview } from '../../../frontend/src/features/seller/paymentDecisions';
import type { ReceiptComparison } from '../../../frontend/src/features/seller/resolution';
import { account, orders, receipt, timestamp } from './data';

export const revision: Revision = {
  id: 'synthetic-revision', revision_number: 1, actor: 'buyer', reason: null,
  created_at: timestamp, claim_accepted_at: timestamp,
  buyer_name: 'Synthetic buyer / পরীক্ষামূলক ক্রেতা', contact_number: '01900000000',
  address: { raw_text: 'Synthetic house, road and landmark / পরীক্ষামূলক ঠিকানা' },
  payment_claim: { provider: 'bkash', trx_id: receipt.trx_id,
    sender_number: '01900000000', amount_minor: 45000 },
};
export const preview: PaymentPreview = {
  order_id: orders[1].id, expected_version: 1, expected_transaction_version: 1,
  receipt, claim_provider: 'bkash', claim_trx_id: receipt.trx_id,
  claim_sender: '01900000000', claim_amount_minor: 45000,
  claim_submitted_at: timestamp, order_created_at: timestamp,
  account_provider: 'bkash', payment_account_id: account.id, total_minor: 250000,
  required_advance_minor: 50000, accepted_amount_minor: 50000, actual_cod_minor: 200000,
  exceptions: ['AMOUNT_MISMATCH'], blockers: [],
};
export const comparison: ReceiptComparison = {
  receipt: { ...receipt, observations: [{
    id: 'synthetic-observation', transaction_id: receipt.id, payment_account_id: account.id,
    source: 'manual', provider: 'bkash', trx_id: receipt.trx_id, actor: 'seller',
    amount_minor: 50000, sender_number_canonical: '01900000000', occurred_at: timestamp,
    parse_state: 'valid', conflict_state: 'none', created_at: timestamp,
  }] }, allocated_order_id: null, claims: [{
    order_id: orders[1].id, revision_id: revision.id, lifecycle: 'pending',
    buyer_name: revision.buyer_name, sender_number: '01900000000', amount_minor: 45000,
    submitted_at: timestamp, review_reasons: ['AMOUNT_MISMATCH'], held_by_resolution: false,
  }], history: [], corrections: [],
};
