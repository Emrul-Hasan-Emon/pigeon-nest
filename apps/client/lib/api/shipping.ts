import { http } from './http';
import { ENDPOINTS } from '../endpoints';
import type {
  Country,
  DeliveryType,
  SettingItem,
  ShippingQuote,
  ShippingZone,
  ZoneListParams,
  ZoneListResponse,
  ZonePayload,
} from '@/types/shipping';

const E = ENDPOINTS.admin;

export function listCountries() {
  return http.get<Country[]>(E.countries.list);
}

export function listZones(params: ZoneListParams) {
  return http.get<ZoneListResponse>(E.shippingZones.list, { ...params });
}
export function getZone(id: number) {
  return http.get<ShippingZone>(E.shippingZones.detail(id));
}
export function createZone(payload: ZonePayload) {
  return http.post<ShippingZone>(E.shippingZones.list, payload);
}
export function updateZone(id: number, payload: ZonePayload) {
  return http.patch<ShippingZone>(E.shippingZones.detail(id), payload);
}
export function deleteZone(id: number) {
  return http.delete<void>(E.shippingZones.detail(id));
}
export function quoteShipping(country: string, deliveryType: DeliveryType) {
  return http.get<ShippingQuote>(E.shippingZones.quote, { country, deliveryType });
}

export function listSettings() {
  return http.get<SettingItem[]>(E.settings.list);
}
export function updateSettings(settings: Record<string, number | boolean>) {
  return http.patch<SettingItem[]>(E.settings.list, { settings });
}
