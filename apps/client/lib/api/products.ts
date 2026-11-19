import { http } from './http';
import { ENDPOINTS } from '../endpoints';
import type {
  Product,
  ProductListParams,
  ProductListResponse,
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
  sellerId: number;
  categoryId: number;
  collectionId?: number;
  name: string;
  description?: string;
  isFeatured?: boolean;
  isPublished?: boolean;
  isActive?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  skus: CreateSkuPayload[];
}

export interface UpdateProductPayload {
  categoryId?: number;
  collectionId?: number | null;
  name?: string;
  description?: string;
  isFeatured?: boolean;
  isPublished?: boolean;
  isActive?: boolean;
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
