import {
  buildMediaForm,
  createProduct,
  removeSkuParent,
  saveSkuParent,
  getProduct,
  copyProduct,
  updateProduct,
  updateProductMediaFiles,
  type CreateProductPayload,
  type ProductMediaFilesPayload,
  type SkuParentPayload,
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
  removeMyProductParent,
  saveMyProductParent,
  copyMyProduct,
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
  /** A switched-off copy of a product. */
  copy(id: number): Promise<Product>;
  updateMedia(id: number, payload: ProductMediaFilesPayload): Promise<Product>;
  categoryTree(): Promise<CategoryTreeNode[]>;
  collections(): Promise<Collection[]>;
  attributes(): Promise<Attribute[]>;
  /** Adds or changes the father or mother of one option. Answers with the whole product. */
  saveParent(productId: number, skuId: number, role: 'sire' | 'dam', payload: SkuParentPayload): Promise<Product>;
  removeParent(productId: number, skuId: number, role: 'sire' | 'dam'): Promise<Product>;
}

export const adminProductPortal: ProductPortal = {
  kind: 'admin',
  basePath: '/admin/catalog/products',
  editPath: (id) => `/admin/catalog/products/${id}/edit`,
  afterCreatePath: (id) => `/admin/catalog/products/${id}`,
  get: getProduct,
  create: createProduct,
  update: updateProduct,
  copy: copyProduct,
  updateMedia: updateProductMediaFiles,
  categoryTree: () => getCategoryTree(),
  collections: () => listCollections({ isActive: true, limit: 100 }).then((r) => r.results),
  attributes: () => listAttributes({ isActive: true, limit: 100 }).then((r) => r.results),
  saveParent: saveSkuParent,
  removeParent: removeSkuParent,
};

export const sellerProductPortal: ProductPortal = {
  kind: 'seller',
  basePath: '/seller/products',
  editPath: (id) => `/seller/products/${id}/edit`,
  afterCreatePath: (id) => `/seller/products/${id}`,
  get: getMyProduct,
  create: createMyProduct,
  update: updateMyProduct,
  copy: copyMyProduct,
  updateMedia: updateMyProductMediaFiles,
  categoryTree: getSellerCategoryTree,
  collections: () => listSellerCollections().then((r) => r.results),
  attributes: () => listSellerAttributes().then((r) => r.results),
  saveParent: saveMyProductParent,
  removeParent: removeMyProductParent,
};

export { buildMediaForm };
