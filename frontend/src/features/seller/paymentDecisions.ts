import type { ReceiptView, SellerOrder } from './types';
import { requestJson } from './api';

export interface PaymentPreview {
  order_id: string;
  expected_version: number;
  expected_transaction_version: number;
  receipt: ReceiptView;
  claim_provider: string;
  claim_trx_id: string;
  claim_sender: string;
  claim_amount_minor: number;
  claim_submitted_at: string;
  order_created_at: string;
  account_provider: string;
  payment_account_id: string;
  total_minor: number;
  required_advance_minor: number;
  accepted_amount_minor: number;
  actual_cod_minor: number | null;
  exceptions: string[];
  blockers: string[];
}

export interface PaymentDecision {
  action: 'confirm';
  expected_version: number;
  expected_transaction_version: number;
  transaction_id: string;
  accepted_amount_minor: number;
  reason: string;
}

export interface CancelDecision {
  action: 'cancel';
  expected_version: number;
  reason: string;
}

export interface RejectDecision {
  action: 'reject';
  expected_version: number;
  reason: string;
}

export interface OrderReplacementInput {
  expected_version: number;
  reason: string;
  order: {
    product_name: string;
    total_minor: number;
    required_advance_minor: number;
    payment_account_id: string;
  };
}

export function previewPayment(orderId: string, receiptId: string, token: string): Promise<PaymentPreview> {
  return requestJson(`/api/seller/orders/${orderId}/payment-preview?transaction_id=${encodeURIComponent(receiptId)}`, {}, token);
}

export function acceptPayment(orderId: string, payload: PaymentDecision, key: string, token: string): Promise<SellerOrder> {
  return requestJson(`/api/seller/orders/${orderId}/decisions`, { method: 'POST', body: JSON.stringify(payload) }, token, key);
}

export function cancelOrder(orderId: string, payload: CancelDecision, key: string, token: string): Promise<SellerOrder> {
  return requestJson(`/api/seller/orders/${orderId}/decisions`, { method: 'POST', body: JSON.stringify(payload) }, token, key);
}

export function rejectOrder(orderId: string, payload: RejectDecision, key: string, token: string): Promise<SellerOrder> {
  return requestJson(`/api/seller/orders/${orderId}/decisions`, { method: 'POST', body: JSON.stringify(payload) }, token, key);
}

export function replaceOrder(orderId: string, payload: OrderReplacementInput, key: string, token: string): Promise<SellerOrder> {
  return requestJson(`/api/seller/orders/${orderId}/replacement`, { method: 'POST', body: JSON.stringify(payload) }, token, key);
}
