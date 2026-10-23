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
