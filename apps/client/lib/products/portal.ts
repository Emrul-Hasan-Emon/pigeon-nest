import {
  buildMediaForm,
  createProduct,
  getProduct,
  updateProduct,
  updateProductMediaFiles,
  type CreateProductPayload,
  type ProductMediaFilesPayload,
  type UpdateProductPayload,
} from '@/lib/api/products';
import { getCategoryTree } from '@/lib/api/categories';
import { listCollections } from '@/lib/api/collections';
import { listAttributes } from '@/lib/api/attributes';
import {
  createMyProduct,
  getMyProduct,
  getSellerCategoryTree,
  listSellerAttributes,
  listSellerCollections,
  updateMyProduct,
  updateMyProductMediaFiles,
} from '@/lib/api/seller-products';
import type { Product } from '@/types/product';
import type { CategoryTreeNode } from '@/types/category';
import type { Collection } from '@/types/collection';
import type { Attribute } from '@/types/attribute';

/**
 * The product forms are shared by the admin and the seller portal. A portal
 * says which API to call, where the pages live, and which fields exist.
 */
export interface ProductPortal {
  kind: 'admin' | 'seller';
  /** Page prefix, e.g. /admin/catalog/products */
  basePath: string;
  /** Where a product is edited. */
  editPath(id: number): string;
  /** Where a product is shown after it is created. */
  afterCreatePath(id: number): string;
  get(id: number): Promise<Product>;
  create(payload: CreateProductPayload): Promise<Product>;
  update(id: number, payload: UpdateProductPayload): Promise<Product>;
  updateMedia(id: number, payload: ProductMediaFilesPayload): Promise<Product>;
  categoryTree(): Promise<CategoryTreeNode[]>;
  collections(): Promise<Collection[]>;
  attributes(): Promise<Attribute[]>;
}

export const adminProductPortal: ProductPortal = {
  kind: 'admin',
  basePath: '/admin/catalog/products',
  editPath: (id) => `/admin/catalog/products/${id}/edit`,
  afterCreatePath: (id) => `/admin/catalog/products/${id}`,
  get: getProduct,
  create: createProduct,
  update: updateProduct,
  updateMedia: updateProductMediaFiles,
  categoryTree: () => getCategoryTree(),
  collections: () => listCollections({ isActive: true, limit: 100 }).then((r) => r.results),
  attributes: () => listAttributes({ isActive: true, limit: 100 }).then((r) => r.results),
};

export const sellerProductPortal: ProductPortal = {
  kind: 'seller',
  basePath: '/seller/products',
  editPath: (id) => `/seller/products/${id}`,
  afterCreatePath: (id) => `/seller/products/${id}`,
  get: getMyProduct,
  create: createMyProduct,
  update: updateMyProduct,
  updateMedia: updateMyProductMediaFiles,
  categoryTree: getSellerCategoryTree,
  collections: () => listSellerCollections().then((r) => r.results),
  attributes: () => listSellerAttributes().then((r) => r.results),
};

export { buildMediaForm };
