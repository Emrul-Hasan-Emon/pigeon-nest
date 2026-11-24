export type ReturnStatus =
  | 'return_requested'
  | 'accepted'
  | 'rejected'
  | 'processing'
  | 'returning_money'
  | 'returned'
  | 'cancelled';
export type ReturnScope = 'full_order' | 'items';
export type ReturnViewer = 'user' | 'seller' | 'admin';

export const RETURN_STATUSES: ReturnStatus[] = [
  'return_requested',
  'accepted',
  'rejected',
  'processing',
  'returning_money',
  'returned',
  'cancelled',
];

export interface ReturnAttachment {
  id: number;
  kind: 'image' | 'file';
  fileName: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedBy: { name: string | null; type: 'seller' | 'admin' | 'user' | null };
  createdAt: string;
}

export interface ReturnHistoryEntry {
  id: number;
  fromStatus: ReturnStatus | null;
  status: ReturnStatus;
  note: string | null;
  by: { name: string | null; type: string | null };
  createdAt: string;
  attachments: ReturnAttachment[];
}

export interface ReturnItemView {
  id: number;
  orderItemId: number;
  productName: string;
  productId: number | null;
  skuLabel: string | null;
  /** The bird as it was sold. Null for other items and for older orders. */
  bird?: import('./order').OrderItemBird | null;
  imageUrl: string | null;
  quantity: number;
  refundAmount: number;
  isReturned: boolean;
  /** Seller and admin only. */
  commissionAmount?: number;
}

export interface ReturnSummary {
  id: number;
  returnNumber: string;
  status: ReturnStatus;
  scope: ReturnScope;
  reason: string;
  order: { id: number; orderNumber: string | null; status: string | null; isReturned: boolean };
  seller: { id: number; name: string };
  itemCount: number;
  previewItems: { productName: string }[];
  refundAmount: number;
  includeDeliveryCharge: boolean;
  /** Seller and admin only. */
  commissionAmount?: number;
  createdAt: string;
  returnedAt: string | null;
  requestedBy: { name: string | null; type: string | null };
}

export interface ReturnDetail extends ReturnSummary {
  itemsAmount: number;
  deliveryAmount: number;
  deliveryCharge: number;
  items: ReturnItemView[];
  customer: { userId: number | null; isGuest: boolean; name: string | null; phone: string | null; email: string | null };
  history: ReturnHistoryEntry[];
  actions: {
    canCancel: boolean;
    sellerNext: ('accept' | 'reject' | 'processing' | 'returning_money')[];
    adminTargets: ReturnStatus[];
    canEditDelivery: boolean;
  };
}

export interface ReturnPage {
  results: ReturnSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ReturnListParams {
  page?: number;
  pageSize?: number;
  status?: ReturnStatus;
  scope?: ReturnScope;
  search?: string;
  sellerId?: number;
  userId?: number;
  orderId?: number;
}

export interface ReturnEligibility {
  orderId: number;
  orderNumber: string;
  returnWindowDays: number;
  windowEndsAt: string | null;
  fullOrder: {
    allowed: boolean;
    reason: string | null;
    itemsAmount: number;
    deliveryCharge: number;
    includeDeliveryCharge: boolean;
    refundAmount: number;
  };
  items: {
    orderItemId: number;
    productName: string;
    quantity: number;
    refundAmount: number;
    allowed: boolean;
    reason: string | null;
  }[];
}

/** A return on an order screen. */
export interface OrderReturnRef {
  id: number;
  returnNumber: string;
  status: ReturnStatus;
  scope: ReturnScope;
  refundAmount: number;
  orderItemIds: number[];
  createdAt: string;
}

export interface CreateReturnInput {
  orderId: number;
  scope: ReturnScope;
  orderItemIds?: number[];
  reason: string;
  /** Admin only: full-order returns. */
  includeDeliveryCharge?: boolean;
  files?: File[];
}

/** One move of a seller's commission balance. */
export interface CommissionChangeRow {
  id: number;
  systemCommissionId: number;
  sellerId: number;
  sellerName: string | null;
  historyId: number | null;
  orderId: number | null;
  orderItemId: number | null;
  orderReturnId: number | null;
  commissionStatus: string;
  currentTotalCommission: number;
  currentDueCommission: number;
  currentPaidCommission: number;
  newTotalCommission: number;
  newDueCommission: number;
  newPaidCommission: number;
  note: string | null;
  creatorName: string | null;
  creatorType: string | null;
  createdAt: string;
}
