import { sellerHttp } from './http';
import { ENDPOINTS } from '../endpoints';
import {
  buildMediaForm,
  buildParentForm,
  type SkuParentPayload,
  type CreateProductPayload,
  type ProductMediaFilesPayload,
  type UpdateProductPayload,
} from './products';
import type { Product, ProductListResponse, SellerProductListParams } from '@/types/product';
import type { CategoryTreeNode } from '@/types/category';
import type { CollectionListResponse } from '@/types/collection';
import type { AttributeListResponse } from '@/types/attribute';
import type { BulkProductPayload, BulkProductResult } from '@/types/product';

// The seller's own products. A seller cannot send sellerId, isFeatured,
// status or reason; the server rejects them.

export function listMyProducts(params: SellerProductListParams) {
  return sellerHttp.get<ProductListResponse>(ENDPOINTS.seller.products.list, { ...params });
}

export function getMyProduct(id: number) {
  return sellerHttp.get<Product>(ENDPOINTS.seller.products.detail(id));
}

export function createMyProduct(payload: CreateProductPayload) {
  return sellerHttp.post<Product>(ENDPOINTS.seller.products.list, payload);
}

export function updateMyProduct(id: number, payload: UpdateProductPayload) {
  return sellerHttp.patch<Product>(ENDPOINTS.seller.products.detail(id), payload);
}

export function deleteMyProduct(id: number) {
  return sellerHttp.delete<void>(ENDPOINTS.seller.products.detail(id));
}

export function updateMyProductMediaFiles(id: number, payload: ProductMediaFilesPayload) {
  return sellerHttp.patch<Product>(ENDPOINTS.seller.products.mediaFiles(id), buildMediaForm(payload));
}

export function saveMyProductParent(productId: number, skuId: number, role: 'sire' | 'dam', payload: SkuParentPayload) {
  return sellerHttp.put<Product>(ENDPOINTS.seller.products.parent(productId, skuId, role), buildParentForm(payload));
}

export function removeMyProductParent(productId: number, skuId: number, role: 'sire' | 'dam') {
  return sellerHttp.delete<Product>(ENDPOINTS.seller.products.parent(productId, skuId, role));
}

// Read-only lookups for the product form.
export function getSellerCategoryTree() {
  return sellerHttp.get<CategoryTreeNode[]>(ENDPOINTS.seller.catalog.categoryTree);
}

export function listSellerCollections() {
  return sellerHttp.get<CollectionListResponse>(ENDPOINTS.seller.catalog.collections, { limit: 100 });
}

export function listSellerAttributes() {
  return sellerHttp.get<AttributeListResponse>(ENDPOINTS.seller.catalog.attributes, { limit: 100 });
}

/** Switch many of the seller's products on or off, or change their prices. */
export function bulkMyProducts(payload: BulkProductPayload) {
  return sellerHttp.post<BulkProductResult>(`${ENDPOINTS.seller.products.list}/bulk`, payload);
}

/** A new product made from one of the seller's own. It starts switched off. */
export function copyMyProduct(id: number) {
  return sellerHttp.post<Product>(`/products/${id}/copy`);
}
