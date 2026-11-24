import { userHttp } from './http';
import { ENDPOINTS } from '../endpoints';
import type {
  BirdFilters,
  CategoryNode,
  SeeAllTarget,
  PageResult,
  ProductDetail,
  ProductQuery,
  SellerCard,
  SellerDetails,
  StoreCategoryDetail,
  StoreCollection,
  StoreCollectionDetail,
  StoreDevice,
  StoreHomepage,
  StoreProduct,
} from '@/types/storefront';

const E = ENDPOINTS.user;

export function getHomepage(device: StoreDevice, page: 'main' | 'slots' = 'main') {
  return userHttp.get<StoreHomepage>(E.homepage, { device, page });
}

export function listProducts(query: ProductQuery) {
  return userHttp.get<PageResult<StoreProduct>>(E.products.list, { ...query });
}
export function getBirdFilters() {
  return userHttp.get<BirdFilters>(`${E.products.list}/bird-filters`);
}
export function getProduct(id: number) {
  return userHttp.get<ProductDetail>(E.products.detail(id));
}

export function getCategoryTree() {
  return userHttp.get<CategoryNode[]>(E.categories.tree);
}
export function getCategory(slug: string) {
  return userHttp.get<StoreCategoryDetail>(E.categories.detail(slug));
}

export function listCollections(page = 1, pageSize = 50) {
  return userHttp.get<PageResult<StoreCollection>>(E.collections.list, { page, pageSize });
}
export function getCollection(slug: string) {
  return userHttp.get<StoreCollectionDetail>(E.collections.detail(slug));
}

export function listSellers(query: { search?: string; sort?: 'newest' | 'nameAsc'; page?: number; pageSize?: number }) {
  return userHttp.get<PageResult<SellerCard>>(E.sellers.list, { ...query });
}
export function getSeller(id: number) {
  return userHttp.get<SellerDetails>(E.sellers.detail(id));
}

/** `/products/94-blue-bar-racing-homer`: the id picks the product, the slug is for people. */
export function productHref(product: { id: number; slug: string }) {
  return `/products/${product.id}-${product.slug}`;
}
export function parseProductParam(param: string): number | null {
  const id = Number.parseInt(param, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** The list page a section's "See all" button opens. */
export function seeAllHref(target: SeeAllTarget): string {
  switch (target.type) {
    case 'category':
      return `/categories/${target.slug}`;
    case 'collection':
      return `/collections/${target.slug}`;
    case 'featured':
      return '/products?featured=true';
    case 'collections':
      return '/collections';
    case 'sellers':
      return '/sellers';
    default:
      return '/products';
  }
}
