export interface PathaoSelection {
  catalog_version?: string;
  city_id?: number;
  zone_id?: number;
  area_id?: number;
  unsupported?: boolean;
}
export interface PathaoResolution extends Omit<PathaoSelection, 'city_id' | 'zone_id' | 'area_id'> {
  city_id: number | null;
  zone_id: number | null;
  area_id: number | null;
  condition: 'resolved' | 'missing_choices' | 'disconnected' | 'unavailable' | 'unsupported' | 'no_area_unverified';
  environment: 'offline' | 'sandbox' | 'production';
  city_name: string | null;
  zone_name: string | null;
  area_name: string | null;
  booking_blocked: boolean;
}
export interface LocationChoice { id: number; name: string; home_delivery_available?: boolean | null }
export interface LocationAvailability {
  catalog_version?: string;
  state: 'loading' | 'ready' | 'unavailable';
  city: boolean;
  zone: boolean;
  area: boolean;
}
export interface LocationCatalog {
  catalog_version?: string;
  condition: PathaoResolution['condition'];
  environment: PathaoResolution['environment'];
  simulated: boolean;
  choices: LocationChoice[];
}
