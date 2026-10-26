import type { PathaoConnection, PathaoDeliveryType, PathaoEnvironment } from './pathaoTypes';
import type { LocationChoice, PathaoSelection } from '../buyer/pathaoTypes';

export interface ReviewChoices {
  environment: PathaoEnvironment;
  store_id: number | null;
  delivery_type: PathaoDeliveryType | null;
  location: PathaoSelection;
}

export interface BookingSnapshot {
  order_id: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  city_id: number;
  zone_id: number;
  area_id: number | null;
  store_id: number;
  delivery_type: number;
  item_weight_grams: number;
  item_quantity: number;
  amount_to_collect_bdt: number;
  remaining_cod_minor: number;
}

export interface CourierAttempt {
  id: string;
  order_id: string;
  attempt_number: number;
  status: 'submitting' | 'success' | 'failed' | 'unknown';
  environment: PathaoEnvironment;
  simulated: boolean;
  reviewed_token: string;
  correlation_id: string;
  consignment_id: string | null;
  booking_snapshot: BookingSnapshot | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  token: string;
  reviewed: boolean;
  submission_enabled: boolean;
  choices: ReviewChoices;
  connection: PathaoConnection;
  stores: { id: number; name: string }[];
  location: { city_name: string | null; zone_name: string | null; area_name: string | null };
  blockers: string[];
  draft: {
    version: number;
    recipient_name: string; contact_number: string; address: string;
    parcel_weight_grams: number | null; parcel_quantity: number | null; remaining_cod_minor: number;
  };
  latest_attempt?: CourierAttempt | null;
}

export interface ReviewCatalog { choices: LocationChoice[] }

export interface ParcelRevision {
  version: number;
  parcel_weight_grams: number | null;
  parcel_quantity: number | null;
}
