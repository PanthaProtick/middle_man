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
