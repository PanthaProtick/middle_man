import type { PathaoConnection, PathaoDeliveryType, PathaoEnvironment } from './pathaoTypes';
import type { LocationChoice, PathaoSelection } from '../buyer/pathaoTypes';

export interface ReviewChoices {
  environment: PathaoEnvironment;
  store_id: number | null;
  delivery_type: PathaoDeliveryType | null;
  location: PathaoSelection;
}
export interface Review {
  token: string;
  reviewed: boolean;
  submission_enabled: false;
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
}
export interface ReviewCatalog { choices: LocationChoice[] }

export interface ParcelRevision {
  version: number;
  parcel_weight_grams: number | null;
  parcel_quantity: number | null;
}
