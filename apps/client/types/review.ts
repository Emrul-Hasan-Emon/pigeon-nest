export type ReviewStatus = 'published' | 'hidden';
export type ReviewReportReason = 'spam' | 'abusive' | 'fake' | 'irrelevant' | 'other';
export type ReviewReportStatus = 'open' | 'resolved_hidden' | 'dismissed';
export type AuthorType = 'user' | 'seller' | 'admin';

export interface CursorPage<T> {
  results: T[];
  nextCursor: number | null;
}

export interface ReviewImage {
  id: number;
  url: string;
  fileName: string;
}

export interface RatingSummary {
  productId: number;
  ratingAverage: number;
  ratingCount: number;
  breakdown: Record<'1' | '2' | '3' | '4' | '5', number>;
}

/** A published review as anyone sees it: the name is masked. */
export interface PublicReview {
  id: number;
  rating: number;
  title: string | null;
  comment: string | null;
  images: ReviewImage[];
  reviewerName: string;
  verifiedPurchase: boolean;
  skuData: Record<string, unknown> | null;
  helpfulCount: number;
  replyCount: number;
  editedAt: string | null;
  createdAt: string;
}

/** A customer's own review, hidden ones and the reason included. */
export interface MyReview {
  id: number;
  productId: number;
  product: { id: number; name: string | null; slug: string | null; thumbnailUrl: string | null };
  orderId: number;
  orderNumber: string;
  orderItemId: number;
  skuData: Record<string, unknown> | null;
  rating: number;
  title: string | null;
  comment: string | null;
  images: ReviewImage[];
  status: ReviewStatus;
  hiddenReason: string | null;
  helpfulCount: number;
  replyCount: number;
  editedAt: string | null;
  createdAt: string;
  editableUntil: string;
  canEdit: boolean;
}

/** A delivered order line that still waits for a review. */
export interface PendingReviewItem {
  id: number;
  orderId: number;
  orderNumber: string;
  productId: number;
  productName: string;
  productSlug: string | null;
  thumbnailUrl: string | null;
  skuData: Record<string, unknown> | null;
  orderedAt: string;
}

export interface ReviewReply {
  id: number;
  parentId: number | null;
  depth: number;
  authorType: AuthorType;
  authorName: string;
  /** Only staff views carry the author's id. */
  authorId?: number;
  replyToName: string | null;
  body: string | null;
  hidden: boolean;
  deleted: boolean;
  hiddenReason?: string | null;
  editedAt: string | null;
  createdAt: string;
  replyCount: number;
}

export interface SellerReview {
  id: number;
  productId: number;
  productName: string;
  productSlug: string;
  rating: number;
  title: string | null;
  comment: string | null;
  images: ReviewImage[];
  reviewerName: string;
  skuData: Record<string, unknown> | null;
  helpfulCount: number;
  replyCount: number;
  sellerReplied: boolean;
  editedAt: string | null;
  createdAt: string;
}

export interface SellerReviewSummary {
  ratingCount: number;
  ratingAverage: number;
  breakdown: Record<'1' | '2' | '3' | '4' | '5', number>;
  unreplied: number;
}

export interface AdminReview {
  id: number;
  rating: number;
  title: string | null;
  comment: string | null;
  status: ReviewStatus;
  hiddenReason: string | null;
  hiddenAt: string | null;
  helpfulCount: number;
  reportCount: number;
  replyCount: number;
  imageCount: number;
  editedAt: string | null;
  createdAt: string;
  orderId: number;
  orderNumber: string;
  user: { id: number; name: string; phone: string | null; email: string | null };
  seller: { id: number; name: string };
  product: { id: number; name: string; slug: string; thumbnailUrl: string | null };
}

export interface AdminReviewDetails extends AdminReview {
  skuData: Record<string, unknown> | null;
  images: ReviewImage[];
  editHistory: {
    id: number;
    fromRating: number;
    toRating: number;
    fromTitle: string | null;
    toTitle: string | null;
    fromComment: string | null;
    toComment: string | null;
    imagesAdded: number;
    imagesRemoved: number;
    createdAt: string;
    creatorName: string | null;
  }[];
  statusHistory: {
    id: number;
    targetType: 'review' | 'reply';
    targetId: number;
    fromStatus: ReviewStatus;
    toStatus: ReviewStatus;
    reason: string | null;
    createdAt: string;
    creatorType: AuthorType | null;
    creatorName: string | null;
  }[];
  reports: ReviewReport[];
}

export interface ReviewReport {
  id: number;
  targetType: 'review' | 'reply';
  targetId: number;
  reviewId?: number;
  reporterType: AuthorType;
  reporterId: number;
  reporterName: string;
  reason: ReviewReportReason;
  note: string | null;
  status: ReviewReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
  resolutionNote: string | null;
  productId?: number;
  productName?: string;
  sellerId?: number;
  sellerName?: string;
  targetText?: string | null;
  targetStatus?: ReviewStatus | null;
}

export type Params = Record<string, string | number | boolean | undefined>;
