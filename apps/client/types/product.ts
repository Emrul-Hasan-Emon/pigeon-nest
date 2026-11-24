export type ProductStatus = 'approved' | 'pending' | 'rejected';
export type ProductActiveStatus = 'active' | 'inactive' | 'suspended';
export type ProductStatusChangeAction =
  | 'baseline'
  | 'admin_created'
  | 'seller_created'
  | 'admin_updated'
  | 'seller_updated';

export interface ProductSeller {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  status: 'pending' | 'approved' | 'rejected';
  activeStatus: 'active' | 'inactive' | 'suspended';
}

export interface ProductCategory {
  id: number;
  name: string;
}

export interface ProductCollection {
  id: number;
  name: string;
  colorCode: string | null;
}

export interface ProductMedia {
  id: number;
  sellerProductId: number;
  url: string;
  path: string;
  type: 'image' | 'video';
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface SkuVariant {
  id: number;
  attributeId: number;
  attributeValueId: number;
  attribute: { id: number; name: string };
  attributeValue: { id: number; name: string; colorCode: string | null };
}

export interface SkuParent {
  id: number;
  role: 'sire' | 'dam';
  name: string | null;
  ringNumber: string | null;
  imageUrl: string | null;
}

/** Facts about the birds, true for every SKU of a product. All optional. */
export interface BirdProductFields {
  breed: string | null;
  bloodline: string | null;
  bloodlineNote: string | null;
  vaccinationNote: string | null;
  healthNote: string | null;
  raceRecord: string | null;
}

export interface Sku {
  id: number;
  sellerProductId: number;
  sku: string | null;
  description: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  quantity: number;
  lowStockThreshold: number;
  myBuyingPrice: number | null;
  price: number;
  discountedPrice: number | null;
  discountedPriceStartDate: string | null;
  discountedPriceEndDate: string | null;
  isDefault: boolean;
  isActive: boolean;
  acceptProposals: boolean;
  /** Hidden from buyers. 0 or empty means no floor. */
  minProposalPrice: number | null;
  /** The bird this option sells. All optional. Dates are YYYY-MM-DD. */
  ringNumber: string | null;
  hatchDate: string | null;
  vaccineName: string | null;
  vaccinatedOn: string | null;
  /** Sire first, then dam. */
  parents?: SkuParent[];
  variants: SkuVariant[];
}

export interface Product extends Partial<BirdProductFields> {
  id: number;
  sellerId: number;
  seller?: ProductSeller;
  categoryId: number;
  category?: ProductCategory;
  collectionId: number | null;
  collection?: ProductCollection | null;
  name: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  thumbnailPath: string | null;
  isFeatured: boolean;
  /** How many customers have this product in their wishlist. */
  wishlistCount: number;
  ratingAverage: number;
  ratingCount: number;
  /** Visible on the storefront only when approved AND active. */
  status: ProductStatus;
  activeStatus: ProductActiveStatus;
  rejectionReason: string | null;
  suspensionReason: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  media?: ProductMedia[];
  skus?: Sku[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductListResponse {
  results: Product[];
  nextCursor: number | null;
}

export interface ProductListParams {
  search?: string;
  sellerId?: number;
  sellerSearch?: string;
  categoryId?: number;
  collectionId?: number;
  status?: ProductStatus;
  activeStatus?: ProductActiveStatus;
  isFeatured?: boolean;
  sort?: ProductListSort;
  cursor?: number;
  limit?: number;
}

/** mostSaved pages by offset: `cursor` is how many rows were already served. */
export type ProductListSort = 'newest' | 'mostSaved';

export interface SellerProductListParams {
  search?: string;
  categoryId?: number;
  collectionId?: number;
  status?: ProductStatus;
  activeStatus?: ProductActiveStatus;
  sort?: ProductListSort;
  cursor?: number;
  limit?: number;
}

export interface ProductStatusHistoryEntry {
  id: number;
  sellerProductId: number;
  product?: { id: number; name: string; sellerId: number; seller?: { id: number; name: string } };
  fromStatus: ProductStatus | null;
  toStatus: ProductStatus;
  fromActiveStatus: ProductActiveStatus | null;
  toActiveStatus: ProductActiveStatus;
  action: ProductStatusChangeAction;
  reason: string | null;
  creatorName: string | null;
  creatorType: 'admin' | 'seller' | 'user' | null;
  createdAt: string;
}

export interface ProductStatusHistoryParams {
  search?: string;
  productId?: number;
  action?: ProductStatusChangeAction;
  toStatus?: ProductStatus;
  toActiveStatus?: ProductActiveStatus;
  cursor?: number;
  limit?: number;
}

export interface ProductStatusHistoryResponse {
  results: ProductStatusHistoryEntry[];
  nextCursor: number | null;
}

export type BulkProductAction = 'activate' | 'deactivate' | 'price' | 'approve' | 'reject' | 'suspend';

export interface BulkProductPayload {
  productIds: number[];
  action: BulkProductAction;
  mode?: 'percent' | 'amount';
  direction?: 'increase' | 'decrease';
  value?: number;
  reason?: string;
}

export interface BulkProductResult {
  action: BulkProductAction;
  updated: number;
  failed: number;
  results: Array<{ id: number; name: string | null; ok: boolean; error?: string }>;
}

export type StockReason = 'initial' | 'edited' | 'order_placed' | 'order_cancelled' | 'order_reopened';

/** One change to the stock of one option. */
export interface StockMovement {
  id: number;
  sku: { id: number; label: string };
  change: number;
  quantityAfter: number;
  reason: StockReason;
  orderId: number | null;
  note: string | null;
  by: string | null;
  createdAt: string;
}

export interface StockMovementPage {
  results: StockMovement[];
  nextCursor: number | null;
}
