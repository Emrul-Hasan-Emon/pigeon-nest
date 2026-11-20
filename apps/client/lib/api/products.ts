import { http } from './http';
import { ENDPOINTS } from '../endpoints';
import type {
  Product,
  ProductActiveStatus,
  ProductListParams,
  ProductListResponse,
  ProductStatus,
  ProductStatusHistoryParams,
  ProductStatusHistoryResponse,
} from '@/types/product';

export interface SkuVariantPayload {
  attributeId: number;
  attributeValueId: number;
}

export interface CreateSkuPayload {
  sku?: string;
  description?: string;
  quantity?: number;
  lowStockThreshold?: number;
  myBuyingPrice?: number;
  price: number;
  discountedPrice?: number;
  discountedPriceStartDate?: string;
  discountedPriceEndDate?: string;
  isDefault?: boolean;
  isActive?: boolean;
  variants: SkuVariantPayload[];
}

// One entry of `skus` in an update: with `id` it edits that SKU (variants and
// the SKU code are immutable); without `id` it creates a new SKU.
export interface UpdateSkuPayload extends Partial<Omit<CreateSkuPayload, 'variants'>> {
  id?: number;
  variants?: SkuVariantPayload[];
}

export interface CreateProductPayload {
  /** Admin only: the seller the product is created for. */
  sellerId?: number;
  categoryId: number;
  collectionId?: number;
  name: string;
  description?: string;
  /** Admin only. */
  isFeatured?: boolean;
  /** Admin only. New products default to approved. */
  status?: ProductStatus;
  /** Sellers may only send active or inactive. */
  activeStatus?: ProductActiveStatus;
  /** Admin only: required when the product is rejected or suspended. */
  reason?: string;
  seoTitle?: string;
  seoDescription?: string;
  skus: CreateSkuPayload[];
}

export interface UpdateProductPayload {
  categoryId?: number;
  collectionId?: number | null;
  name?: string;
  description?: string;
  /** Admin only. */
  isFeatured?: boolean;
  /** Admin only. */
  status?: ProductStatus;
  /** Sellers may only send active or inactive. */
  activeStatus?: ProductActiveStatus;
  /** Admin only: required when this edit rejects or suspends the product. */
  reason?: string;
  seoTitle?: string;
  seoDescription?: string;
  skus?: UpdateSkuPayload[];
  removeSkuIds?: number[];
}

export interface ProductMediaFilesPayload {
  thumbnailImage?: File | null;
  removeThumbnail?: boolean;
  mediaFiles?: File[];
  removeMediaFilesIds?: number[];
}

export function listProducts(params: ProductListParams) {
  return http.get<ProductListResponse>(ENDPOINTS.admin.products.list, { ...params });
}

export function getProduct(id: number) {
  return http.get<Product>(ENDPOINTS.admin.products.detail(id));
}

export function createProduct(payload: CreateProductPayload) {
  return http.post<Product>(ENDPOINTS.admin.products.list, payload);
}

export function updateProduct(id: number, payload: UpdateProductPayload) {
  return http.patch<Product>(ENDPOINTS.admin.products.detail(id), payload);
}

export function deleteProduct(id: number) {
  return http.delete<void>(ENDPOINTS.admin.products.detail(id));
}

export function updateProductMediaFiles(id: number, payload: ProductMediaFilesPayload) {
  const form = new FormData();
  if (payload.thumbnailImage) form.append('thumbnailImage', payload.thumbnailImage);
  if (payload.removeThumbnail) form.append('removeThumbnail', 'true');
  for (const file of payload.mediaFiles ?? []) form.append('mediaFiles', file);
  for (const mediaId of payload.removeMediaFilesIds ?? []) {
    form.append('removeMediaFilesIds', String(mediaId));
  }
  return http.patch<Product>(ENDPOINTS.admin.products.mediaFiles(id), form);
}

export function listProductStatusHistory(params: ProductStatusHistoryParams) {
  return http.get<ProductStatusHistoryResponse>(ENDPOINTS.admin.productStatusHistory.list, {
    ...params,
  });
}

export function buildMediaForm(payload: ProductMediaFilesPayload) {
  const form = new FormData();
  if (payload.thumbnailImage) form.append('thumbnailImage', payload.thumbnailImage);
  if (payload.removeThumbnail) form.append('removeThumbnail', 'true');
  for (const file of payload.mediaFiles ?? []) form.append('mediaFiles', file);
  for (const mediaId of payload.removeMediaFilesIds ?? []) {
    form.append('removeMediaFilesIds', String(mediaId));
  }
  return form;
}
