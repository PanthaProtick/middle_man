export interface PublicOrder {
  id: string;
  shop_display_name: string;
  product_name: string;
  total_minor: number;
  required_advance_minor: number;
  expected_cod_minor: number;
  actual_cod_minor: number | null;
  account_provider: string;
  account_receiving_number: string;
  account_label: string;
  lifecycle: 'awaiting_buyer' | 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'expired';
  status_message: string;
  submission_acknowledgement: string | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
}

export interface AddressInput {
  raw_text: string;
  district?: string;
  thana?: string;
  area?: string;
  street_line?: string;
  landmark?: string;
}

export interface PaymentClaimInput {
  provider: 'bkash' | 'nagad';
  trx_id: string;
  sender_number: string;
  amount_minor: number;
  claimed_at?: string;
  evidence_id?: string;
}

export interface BuyerSubmissionInput {
  buyer_name: string;
  contact_number: string;
  address: AddressInput;
  payment_claim: PaymentClaimInput;
}

export interface BuyerFormDraft {
  buyer_name: string;
  contact_number: string;
  address_raw: string;
  payment_provider: 'bkash' | 'nagad';
  payment_sender: string;
  payment_trx_id: string;
  claimed_advance_bdt: string;
}
