import { http } from './http';
import { ENDPOINTS } from '../endpoints';
import type {
  Attribute,
  AttributeListParams,
  AttributeListResponse,
  AttributeValue,
} from '@/types/attribute';

export interface AttributeWritePayload {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface CreateAttributePayload extends AttributeWritePayload {
  name: string;
  values?: Array<{ name: string; colorCode?: string | null; sortOrder?: number }>;
}

export interface AttributeValueWritePayload {
  name?: string;
  description?: string | null;
  colorCode?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export function listAttributes(params: AttributeListParams) {
  return http.get<AttributeListResponse>(ENDPOINTS.admin.attributes.list, { ...params });
}

export function createAttribute(payload: CreateAttributePayload) {
  return http.post<Attribute>(ENDPOINTS.admin.attributes.list, payload);
}

export function updateAttribute(id: number, payload: AttributeWritePayload) {
  return http.patch<Attribute>(ENDPOINTS.admin.attributes.detail(id), payload);
}

export function deleteAttribute(id: number) {
  return http.delete<void>(ENDPOINTS.admin.attributes.detail(id));
}

export function createAttributeValue(
  attributeId: number,
  payload: AttributeValueWritePayload,
) {
  return http.post<AttributeValue>(ENDPOINTS.admin.attributes.values(attributeId), payload);
}

export function updateAttributeValue(
  valueId: number,
  payload: AttributeValueWritePayload,
) {
  return http.patch<AttributeValue>(ENDPOINTS.admin.attributeValues.detail(valueId), payload);
}

export function deleteAttributeValue(valueId: number) {
  return http.delete<void>(ENDPOINTS.admin.attributeValues.detail(valueId));
}
