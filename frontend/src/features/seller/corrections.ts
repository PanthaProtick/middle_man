import { requestJson } from './api';
import type { SellerOrder } from './types';

export interface BuyerDetails {
  buyer_name: string;
  contact_number: string;
  address: {raw_text: string; district?: string | null; thana?: string | null; area?: string | null;
    street_line?: string | null; landmark?: string | null};
  payment_claim: {provider: 'bkash' | 'nagad'; trx_id: string; sender_number: string;
    amount_minor: number; claimed_at?: string | null; evidence_id?: string | null};
}
export interface Revision extends BuyerDetails {
  id: string; revision_number: number; actor: string; reason: string | null;
  created_at: string; claim_accepted_at: string;
}
export interface History {items: Revision[]; next_cursor: string | null}
export interface CorrectionInput {
  expected_version: number; reason: string;
  buyer_name?: string; contact_number?: string; address?: BuyerDetails['address'];
  payment_claim?: BuyerDetails['payment_claim'];
}
const path = (id: string) => `/api/seller/orders/${encodeURIComponent(id)}`;
export const fetchCorrectionOrder = (id: string, token: string) => requestJson<SellerOrder>(path(id), {}, token);
export const fetchHistory = (id: string, token: string, cursor?: string) =>
  requestJson<History>(`${path(id)}/history?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, {}, token);
export const correctBuyer = (id: string, input: CorrectionInput, key: string, token: string) =>
  requestJson<SellerOrder>(path(id) + '/buyer-details', {method: 'PATCH', body: JSON.stringify(input)}, token, key);
export const resolveCorrectionLink = (portalToken: string, token: string) =>
  requestJson<{order_id: string}>('/api/seller/order-links/resolve', {
    method: 'POST', body: JSON.stringify({portal_token: portalToken}),
  }, token);
