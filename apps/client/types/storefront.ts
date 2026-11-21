export type StoreDevice = 'mobile' | 'web';

export interface StoreBanner {
  id: number;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  position: string;
}
export interface StoreCategory {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
}
export interface StoreCollection extends StoreCategory {
  colorCode: string | null;
}
export interface StoreSeller {
  id: number;
  name: string;
  avatarUrl: string | null;
}
export interface StoreProduct {
  id: number;
  name: string;
  slug: string;
  thumbnailUrl: string | null;
  price: number | null;
  discountedPrice: number | null;
  ratingAverage: number;
  ratingCount: number;
  seller: { id: number; name: string } | null;
  category: { id: number; name: string; slug: string } | null;
}

export interface StoreSection {
  id: number;
  title: string;
  sectionType: string;
  layout: 'carousel' | 'grid' | 'list';
  slotNo: number | null;
  items: unknown[];
  /** Where "See all" leads; null when the section has no list page. */
  seeAll: SeeAllTarget | null;
}

export type SeeAllTarget =
  | { type: 'category'; slug: string }
  | { type: 'collection'; slug: string }
  | { type: 'featured' }
  | { type: 'products' }
  | { type: 'collections' }
  | { type: 'sellers' };

export interface StoreHomepage {
  page: 'main' | 'slots';
  device: StoreDevice;
  sections: StoreSection[];
}

// ---- browse / detail ----

export interface PageResult<T> {
  results: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type ProductSortKey = 'newest' | 'priceAsc' | 'priceDesc' | 'nameAsc';

export interface ProductQuery {
  search?: string;
  categoryId?: number;
  includeSubcategories?: boolean;
  collectionId?: number;
  sellerId?: number;
  featured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSortKey;
  page?: number;
  pageSize?: number;
}

export interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  children: CategoryNode[];
}

export interface Crumb {
  id: number;
  name: string;
  slug: string;
}

export interface StoreCategoryDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  breadcrumb: Crumb[];
  children: StoreCategory[];
}

export interface StoreCollectionDetail extends StoreCollection {
  description: string | null;
}

export interface SellerCard {
  id: number;
  name: string;
  avatarUrl: string | null;
  joinedAt: string;
  productCount: number;
}

export interface ProductSku {
  id: number;
  sku: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  discountedPrice: number | null;
  effectivePrice: number;
  quantity: number;
  inStock: boolean;
  lowStock: boolean;
  isDefault: boolean;
  variants: { attributeId: number; valueId: number }[];
}

export interface ProductOption {
  attributeId: number;
  name: string;
  values: { id: number; name: string; colorCode: string | null }[];
}

export interface ProductDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  isFeatured: boolean;
  ratingAverage: number;
  ratingCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
  category: Crumb | null;
  breadcrumb: Crumb[];
  collection: { id: number; name: string; slug: string; colorCode: string | null } | null;
  seller: { id: number; name: string; avatarUrl: string | null; productCount: number };
  options: ProductOption[];
  skus: ProductSku[];
  media: { id: number; url: string; type: string; altText: string | null; isPrimary: boolean }[];
  related: StoreProduct[];
}
