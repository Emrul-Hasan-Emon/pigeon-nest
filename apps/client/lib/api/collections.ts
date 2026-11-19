import { http } from './http';
import { ENDPOINTS } from '../endpoints';
import type {
  Collection,
  CollectionListParams,
  CollectionListResponse,
} from '@/types/collection';

export interface CollectionWritePayload {
  name?: string;
  description?: string | null;
  colorCode?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  image?: File | null;
}

function buildBody(
  payload: CollectionWritePayload,
): FormData | Record<string, unknown> {
  if (payload.image) {
    const form = new FormData();
    if (payload.name !== undefined) form.set('name', payload.name);
    if (payload.description !== undefined) {
      form.set('description', payload.description ?? '');
    }
    if (payload.colorCode !== undefined) {
      form.set('colorCode', payload.colorCode ?? '');
    }
    if (payload.sortOrder !== undefined) form.set('sortOrder', String(payload.sortOrder));
    if (payload.isActive !== undefined) form.set('isActive', String(payload.isActive));
    form.set('image', payload.image);
    return form;
  }

  const json: Record<string, unknown> = {};
  if (payload.name !== undefined) json.name = payload.name;
  if (payload.description !== undefined) json.description = payload.description;
  if (payload.colorCode !== undefined) json.colorCode = payload.colorCode;
  if (payload.sortOrder !== undefined) json.sortOrder = payload.sortOrder;
  if (payload.isActive !== undefined) json.isActive = payload.isActive;
  return json;
}

export function listCollections(params: CollectionListParams) {
  return http.get<CollectionListResponse>(ENDPOINTS.admin.collections.list, { ...params });
}

export function createCollection(payload: CollectionWritePayload) {
  return http.post<Collection>(ENDPOINTS.admin.collections.list, buildBody(payload));
}

export function updateCollection(id: number, payload: CollectionWritePayload) {
  return http.patch<Collection>(ENDPOINTS.admin.collections.detail(id), buildBody(payload));
}

export function deleteCollection(id: number) {
  return http.delete<void>(ENDPOINTS.admin.collections.detail(id));
}
