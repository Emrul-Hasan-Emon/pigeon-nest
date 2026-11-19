import { http } from './http';
import { ENDPOINTS } from '../endpoints';
import type {
  Category,
  CategoryListParams,
  CategoryListResponse,
  CategoryTreeNode,
  CategoryWithParents,
} from '@/types/category';

export interface CategoryWritePayload {
  name?: string;
  description?: string | null;
  parentId?: number | null;
  sortOrder?: number;
  isActive?: boolean;
  image?: File | null;
}

function buildBody(payload: CategoryWritePayload): FormData | Record<string, unknown> {
  if (payload.image) {
    const form = new FormData();
    if (payload.name !== undefined) form.set('name', payload.name);
    if (payload.description !== undefined) {
      form.set('description', payload.description ?? '');
    }
    if (payload.parentId !== undefined) {
      form.set('parentId', payload.parentId === null ? '' : String(payload.parentId));
    }
    if (payload.sortOrder !== undefined) form.set('sortOrder', String(payload.sortOrder));
    if (payload.isActive !== undefined) form.set('isActive', String(payload.isActive));
    form.set('image', payload.image);
    return form;
  }

  const json: Record<string, unknown> = {};
  if (payload.name !== undefined) json.name = payload.name;
  if (payload.description !== undefined) json.description = payload.description;
  if (payload.parentId !== undefined) json.parentId = payload.parentId;
  if (payload.sortOrder !== undefined) json.sortOrder = payload.sortOrder;
  if (payload.isActive !== undefined) json.isActive = payload.isActive;
  return json;
}

export function listCategories(params: CategoryListParams) {
  return http.get<CategoryListResponse>(ENDPOINTS.admin.categories.list, { ...params });
}

export function createCategory(payload: CategoryWritePayload) {
  return http.post<Category>(ENDPOINTS.admin.categories.list, buildBody(payload));
}

export function updateCategory(id: number, payload: CategoryWritePayload) {
  return http.patch<Category>(ENDPOINTS.admin.categories.detail(id), buildBody(payload));
}

export function deleteCategory(id: number) {
  return http.delete<void>(ENDPOINTS.admin.categories.detail(id));
}

export function getCategoryTree(categoryName?: string) {
  return http.get<CategoryTreeNode[]>(ENDPOINTS.admin.categories.tree, { categoryName });
}

export function getParentChain(categoryIds: number[]) {
  return http.get<CategoryWithParents[]>(ENDPOINTS.admin.categories.parentChain, {
    categoryIds: categoryIds.join(','),
  });
}
