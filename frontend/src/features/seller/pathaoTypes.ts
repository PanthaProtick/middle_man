export type PathaoEnvironment = 'offline' | 'sandbox' | 'production';
export type PathaoDeliveryType = 48 | 12;

export interface PathaoConnectInput {
  expected_version: number;
  credentials?: { client_id: string; client_secret: string; username: string; password: string };
}

export interface PathaoDefaultsInput {
  expected_version: number;
  default_store_id: number;
  default_delivery_type: PathaoDeliveryType;
}

export interface PathaoConnection {
  environment: PathaoEnvironment;
  version: number;
  status: 'disconnected' | 'connected';
  merchant_hint: string | null;
  simulated: boolean;
  production_booking_enabled: boolean;
  default_store_id: number | null;
  default_delivery_type: PathaoDeliveryType | null;
}

export interface PathaoStores {
  environment: PathaoEnvironment;
  version: number;
  simulated: boolean;
  stores: { id: number; name: string }[];
}
