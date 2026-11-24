import { http, sellerHttp } from './http';
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

/** Bird fields of a product. A blank string clears one; a field left out stays as it was. */
export interface BirdProductPayload {
  breed?: string;
  bloodline?: string;
  bloodlineNote?: string;
  vaccinationNote?: string;
  healthNote?: string;
  raceRecord?: string;
}

/** Bird fields of one option. Dates are YYYY-MM-DD; a blank string clears one. */
export interface BirdSkuPayload {
  ringNumber?: string;
  hatchDate?: string;
  vaccineName?: string;
  vaccinatedOn?: string;
}

export interface CreateSkuPayload extends BirdSkuPayload {
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

export interface CreateProductPayload extends BirdProductPayload {
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

export interface UpdateProductPayload extends BirdProductPayload {
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

/** A new product made from this one, same seller, switched off. */
export function copyProduct(id: number) {
  return http.post<Product>(`${ENDPOINTS.admin.products.detail(id)}/copy`);
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

/** The multipart body for adding or changing a sire or dam. */
export interface SkuParentPayload {
  name?: string;
  ringNumber?: string;
  image?: File | null;
  removeImage?: boolean;
}

export function buildParentForm(payload: SkuParentPayload) {
  const form = new FormData();
  if (payload.name !== undefined) form.append('name', payload.name);
  if (payload.ringNumber !== undefined) form.append('ringNumber', payload.ringNumber);
  if (payload.image) form.append('image', payload.image);
  if (payload.removeImage) form.append('removeImage', 'true');
  return form;
}

export function saveSkuParent(productId: number, skuId: number, role: 'sire' | 'dam', payload: SkuParentPayload) {
  return http.put<Product>(ENDPOINTS.admin.products.parent(productId, skuId, role), buildParentForm(payload));
}

export function removeSkuParent(productId: number, skuId: number, role: 'sire' | 'dam') {
  return http.delete<Product>(ENDPOINTS.admin.products.parent(productId, skuId, role));
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

/** The status log of one of the seller's own products (newest first). */
export function listSellerProductStatusHistory(productId: number, params: { cursor?: number; limit?: number } = {}) {
  return sellerHttp.get<ProductStatusHistoryResponse>(`/products/${productId}/status-history`, { ...params });
}
