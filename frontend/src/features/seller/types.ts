export interface Shop {
  id: string;
  owner_id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface ShopStatus {
  shop: Shop | null;
  setup_needed: boolean;
}

export interface PaymentAccount {
  id: string;
  shop_id: string;
  provider: 'bkash' | 'nagad';
  receiving_number: string;
  label: string;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AccountInput {
  provider: 'bkash' | 'nagad';
  receiving_number: string;
  label: string;
}

export interface AccountUpdateInput {
  expected_version: number;
  label?: string;
  is_active?: boolean;
}

export type OrderLifecycle =
  | 'awaiting_buyer'
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export interface SellerOrder {
  id: string;
  shop_id: string;
  payment_account_id: string;
  product_name: string;
  total_minor: number;
  required_advance_minor: number;
  expected_cod_minor: number;
  actual_cod_minor: number | null;
  account_provider: 'bkash' | 'nagad';
  account_receiving_number: string;
  account_label: string;
  lifecycle: OrderLifecycle;
  version: number;
  review_reasons: string[];
  buyer_revision: number | null;
  allocation_basis: string | null;
  portal_token: string;
  portal_url: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  completed_at: string | null;
  predecessor_order_id?: string | null;
  replaced_by_order_id?: string | null;
}

export interface OrderInput {
  product_name: string;
  total_minor: number;
  required_advance_minor: number;
  payment_account_id: string;
}

export interface SellerOrderListResponse {
  items: SellerOrder[];
  next_cursor: string | null;
}

export interface ApiErrorDetail {
  field?: string;
  code: string;
  message: string;
}

export interface ApiError {
  code: string;
  message: string;
  fields?: ApiErrorDetail[];
}

export type ParseState = 'valid' | 'incomplete';
export type ConflictState = 'none' | 'identical' | 'conflicting';
export type ReconciliationState = 'unmatched' | 'conflicted' | 'used';

export interface TransactionObservation {
  id: string;
  transaction_id: string;
  payment_account_id: string;
  source: string;
  provider: string;
  trx_id: string;
  actor: string;
  amount_minor: number;
  sender_number_raw?: string | null;
  sender_number_canonical?: string | null;
  occurred_at?: string | null;
  parse_state: ParseState;
  conflict_state: ConflictState;
  created_at: string;
}

export interface ReceiptView {
  id: string;
  shop_id: string;
  payment_account_id: string;
  provider: 'bkash' | 'nagad';
  trx_id: string;
  amount_minor: number;
  sender_number_raw?: string | null;
  sender_number_canonical?: string | null;
  occurred_at?: string | null;
  reconciliation_state: ReconciliationState;
  has_conflict: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  observations: TransactionObservation[];
  related_claims_count: number;
}

export interface ManualReceiptInput {
  payment_account_id: string;
  provider: 'bkash' | 'nagad';
  trx_id: string;
  amount_minor: number;
  sender_number?: string | null;
  occurred_at?: string | null;
}

export interface ReceiptListResponse {
  items: ReceiptView[];
  next_cursor?: string | null;
}

export interface CleanupFailureItem {
  evidence_type: string;
  evidence_id: string;
  order_id?: string | null;
  delete_after: string;
  error: string;
}

export interface RetentionStatusResponse {
  shop_id: string;
  checked_at: string;
  counts: {
    screenshots_active: number;
    screenshots_deleted: number;
    sms_active: number;
    sms_purged: number;
    ai_extractions_active: number;
    ai_extractions_purged: number;
  };
  overdue_count: number;
  failed_count: number;
  last_cleanup_at?: string | null;
  overdue_items: CleanupFailureItem[];
}

export interface RetentionCleanupResponse {
  shop_id: string;
  ran_at: string;
  items_purged: number;
  items_failed: number;
  overdue_remaining: number;
  status: 'clean' | 'partial_failure' | 'failed';
  failures: CleanupFailureItem[];
}
