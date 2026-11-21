export type Availability = 'available' | 'out_of_stock' | 'unavailable' | 'removed';

export interface PriceChange {
  direction: 'dropped' | 'rose' | 'same';
  amount: number;
}

/** One saved product as the customer sees it, with live details. */
export interface WishlistItem {
  id: number;
  productId: number;
  savedAt: string;
  name: string | null;
  slug: string | null;
  thumbnailUrl: string | null;
  seller: { id: number; name: string } | null;
  /** Today's price; null when the product has no live SKU. */
  price: number | null;
  priceWhenSaved: number;
  priceChange: PriceChange | null;
  stock: number;
  skuCount: number;
  availability: Availability;
  reason: string | null;
}

export interface WishlistListParams {
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sellerId?: number;
  search?: string;
  cursor?: number;
  limit?: number;
}

export interface WishlistPage<T> {
  results: T[];
  nextCursor: number | null;
}

export interface WishlistAck {
  productId: number;
  saved: boolean;
  total: number;
  added?: boolean;
  removed?: boolean;
}

export interface WishlistIds {
  productIds: number[];
  limit: number;
}

export interface AdminWishlistRow {
  id: number;
  savedAt: string;
  priceWhenSaved: number;
  priceChange: PriceChange | null;
  availability: Availability;
  reason: string | null;
  createdBy: number | null;
  creatorType: string | null;
  creatorName: string | null;
  user: { id: number; name: string; phone: string | null; email: string | null };
  seller: { id: number; name: string; phone: string | null; email: string | null } | null;
  product: {
    id: number;
    name: string | null;
    slug: string | null;
    thumbnailUrl: string | null;
    status: string | null;
    activeStatus: string | null;
    deleted: boolean;
    price: number | null;
    stock: number;
    wishlistCount: number;
  };
}

export interface AdminWishlistParams {
  userId?: number;
  sellerId?: number;
  productId?: number;
  search?: string;
  userSearch?: string;
  sellerSearch?: string;
  cursor?: number;
  limit?: number;
}

export interface MostSavedProduct {
  id: number;
  name: string;
  slug: string;
  thumbnailUrl: string | null;
  wishlistCount: number;
  status: string;
  activeStatus: string;
  seller: { id: number; name: string };
  category: { id: number; name: string } | null;
}

export interface SellerWishlistInsights {
  totalSaves: number;
  productsSaved: number;
  products: number;
  top: MostSavedProduct[];
}
