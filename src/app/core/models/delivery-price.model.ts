/**
 * Delivery Price Model
 * Represents a delivery pricing option for a specific country and zone
 */
export interface DeliveryPrice {
  id: string;
  country_code: string;
  zone_code: string;
  label: string;
  description: string | null;
  price: number;
  currency: string;
  is_express: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Request to create or update a delivery price
 */
export interface DeliveryPriceRequest {
  country_code: string;
  zone_code: string;
  label: string;
  description?: string | null;
  price: number;
  currency: string;
  is_express: boolean;
  is_active: boolean;
  display_order?: number;
}

/**
 * Delivery zones for Côte d'Ivoire
 */
export enum CIDeliveryZone {
  ABIDJAN_NORD = 'abidjan_nord',
  ABIDJAN_SUD = 'abidjan_sud',
  HORS_ZONE = 'hors_zone'
}

/**
 * Delivery zones for France
 */
export enum FRDeliveryZone {
  ILE_DE_FRANCE = 'ile_de_france'
}

