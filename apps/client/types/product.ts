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
  variants: SkuVariant[];
}

export interface Product {
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
  isPublished: boolean;
  isActive: boolean;
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
  isPublished?: boolean;
  isFeatured?: boolean;
  isActive?: boolean;
  cursor?: number;
  limit?: number;
}
