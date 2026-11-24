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

/** The public page of one seller: the card plus the about text and the shop rating. */
export interface SellerDetails extends SellerCard {
  description: string | null;
  ratingAverage: number;
  ratingCount: number;
  breakdown: Record<'1' | '2' | '3' | '4' | '5', number>;
}

/** A review of one of the seller's products, as anyone may read it. The name is masked. */
export interface SellerPublicReview {
  id: number;
  productId: number;
  productName: string;
  productSlug: string;
  rating: number;
  title: string | null;
  comment: string | null;
  images: { id: number; url: string }[];
  reviewerName: string;
  helpfulCount: number;
  createdAt: string;
}

/** A bird's father or mother as the seller gave it. */
export interface BirdParent {
  name: string | null;
  ringNumber: string | null;
  imageUrl: string | null;
}

/** What the seller says about the birds of a product. Every value may be null. */
export interface ProductBird {
  breed: string | null;
  bloodline: string | null;
  bloodlineNote: string | null;
  vaccinationNote: string | null;
  healthNote: string | null;
  raceRecord: string | null;
}

/** What the seller says about the one bird an option sells. */
export interface SkuBird {
  ringNumber: string | null;
  hatchDate: string | null;
  vaccineName: string | null;
  vaccinatedOn: string | null;
  sire: BirdParent | null;
  dam: BirdParent | null;
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
  /** Buyers may propose their own price for this SKU. */
  acceptProposals: boolean;
  bird?: SkuBird;
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
  bird?: ProductBird;
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
