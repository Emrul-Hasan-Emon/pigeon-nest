export type DeliveryType = 'standard' | 'express' | 'pickup';

export const DELIVERY_TYPES: { value: DeliveryType; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'express', label: 'Express' },
  { value: 'pickup', label: 'Pickup' },
];

export interface Country {
  code: string;
  name: string;
}

export interface ShippingZone {
  id: number;
  name: string;
  deliveryType: DeliveryType;
  countryCodes: string[];
  countries?: Country[];
  charge: number;
  estimatedDays: number;
  supportsLiveAnimal: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ZoneListParams {
  search?: string;
  deliveryType?: DeliveryType;
  isActive?: boolean;
  country?: string;
  cursor?: number;
  limit?: number;
}

export interface ZoneListResponse {
  results: ShippingZone[];
  nextCursor: number | null;
}

export interface ZonePayload {
  name?: string;
  deliveryType?: DeliveryType;
  countryCodes?: string[];
  charge?: number;
  estimatedDays?: number;
  supportsLiveAnimal?: boolean;
  isActive?: boolean;
}

export interface ShippingQuote {
  charge: number;
  estimatedDays: number;
  supportsLiveAnimal: boolean;
  source: 'zone' | 'default';
  zone: { id: number; name: string } | null;
}

export interface SettingItem {
  key: string;
  label: string;
  description: string;
  group: string;
  type: 'decimal' | 'int' | 'boolean';
  min?: number;
  max?: number;
  default: number | boolean;
  value: number | boolean;
  isDefault: boolean;
}
