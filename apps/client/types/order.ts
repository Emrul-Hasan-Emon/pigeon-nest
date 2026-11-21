export type OrderStatus = 'pending' | 'confirmed' | 'cancelled' | 'packed' | 'shipped' | 'delivered';
export type PaymentStatus = 'due' | 'paid' | 'partially_paid';
export type DeliveryType = 'standard' | 'express' | 'pickup';
export type StaffRole = 'admin' | 'seller';

export const ORDER_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
export const PAYMENT_STATUSES: PaymentStatus[] = ['due', 'partially_paid', 'paid'];
export const DELIVERY_TYPES: DeliveryType[] = ['standard', 'express', 'pickup'];

export interface Actor {
  name: string | null;
  type: 'admin' | 'seller' | 'user' | null;
}

export interface OrderCustomer {
  userId: number | null;
  isGuest: boolean;
  name: string;
  phone: string;
  email: string | null;
}

export interface OrderSummary {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  seller: { id: number; name: string; avatarUrl: string | null };
  itemCount: number;
  previewItems: { productName: string; imageUrl: string | null }[];
  payable: number;
  amountPaid: number;
  gateway: { id: number; name: string; slug: string };
  createdAt: string;
  canCancel: boolean;
  allowedStatuses: OrderStatus[];
  customer: OrderCustomer;
  deliveryType: DeliveryType;
  countryCode: string;
  countryName: string;
}

export interface Attachment {
  id: number;
  kind: 'image' | 'file';
  fileName: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedBy: Actor;
  createdAt: string;
}

export interface OrderItemView {
  id: number;
  productId: number;
  productName: string;
  productSlug: string | null;
  sku: { id: number; code: string | null; label: string };
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  unitPayable: number;
  lineTotal: number;
}

export interface OrderPayment {
  id: number;
  gateway: { id: number; name: string; slug: string };
  status: PaymentStatus;
  amount: number;
  transactionId: string | null;
  description: string | null;
  proof: Record<string, string> | null;
  paidAt: string | null;
  createdAt: string;
  attachments: Attachment[];
  reversal: Reversal | null;
  recordedBy: Actor | null;
}

export interface Reversal {
  at: string;
  by: Actor;
  reason: string | null;
}

export interface PaymentHistoryEntry {
  id: number;
  paymentId: number | null;
  fromStatus: PaymentStatus | null;
  status: PaymentStatus;
  amount: number;
  amountPaidAfter: number;
  note: string | null;
  by: Actor;
  createdAt: string;
}

export interface OrderDetail extends OrderSummary {
  cartId: number | null;
  items: OrderItemView[];
  /** Staff only: the platform's cut, fixed when the order was placed. */
  commission?: { type: 'percentage' | 'fixed' | null; value: number | null; systemCommission: number; sellerAmount: number };
  totals: {
    listTotal: number;
    subtotal: number;
    savings: number;
    deliveryCharge: number;
    discountAmount: number;
    payable: number;
    amountPaid: number;
    balanceDue: number;
  };
  delivery: { type: DeliveryType; estimatedDays: number | null; charge: number; zoneName: string | null };
  address: {
    recipientName: string;
    phone: string;
    email: string | null;
    line: string;
    city: string;
    state: string | null;
    postalCode: string | null;
    countryCode: string;
    countryName: string;
  };
  payments: OrderPayment[];
  paymentHistory: PaymentHistoryEntry[];
  updates: { id: number; message: string | null; attachments: Attachment[]; by: Actor; createdAt: string }[];
  note: string | null;
  statusHistory: { id: number; fromStatus: OrderStatus | null; status: OrderStatus; note: string | null; by: Actor; createdAt: string }[];
  account?: { id: number; name: string; email: string | null; phone: string | null; status: string } | null;
}

export interface OrderListParams {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  sellerSearch?: string;
  customerSearch?: string;
  owner?: 'customer' | 'guest';
  orderNumber?: string;
  gatewayId?: number;
  deliveryType?: DeliveryType;
  countryCode?: string;
  minTotal?: number;
  maxTotal?: number;
  createdFrom?: string;
  createdTo?: string;
  cursor?: number;
  limit?: number;
}
export interface OrderListResponse {
  results: OrderSummary[];
  nextCursor: number | null;
}

export interface PaymentRow {
  id: number;
  orderId: number;
  orderNumber: string | null;
  orderStatus: OrderStatus | null;
  orderPaymentStatus: PaymentStatus | null;
  seller: { id: number; name: string } | null;
  customer: { name: string; phone: string; email: string | null; isGuest: boolean } | null;
  gateway: { id: number; name: string; slug: string };
  status: PaymentStatus;
  amount: number;
  transactionId: string | null;
  description: string | null;
  paidAt: string | null;
  attachmentCount: number;
  reversal: Reversal | null;
  recordedBy: Actor | null;
  createdAt: string;
}
export interface PaymentDetail extends PaymentRow {
  proof: Record<string, string> | null;
  attachments: Attachment[];
  order: {
    id: number;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    payable: number;
    amountPaid: number;
    balanceDue: number;
  };
  history: PaymentHistoryEntry[];
}
export interface PaymentListParams {
  status?: PaymentStatus;
  orderNumber?: string;
  sellerId?: number;
  gatewayId?: number;
  customerSearch?: string;
  transactionId?: string;
  minAmount?: number;
  maxAmount?: number;
  hasAttachments?: boolean;
  reversed?: boolean;
  createdFrom?: string;
  createdTo?: string;
  paidFrom?: string;
  paidTo?: string;
  cursor?: number;
  limit?: number;
}
export interface PaymentListResponse {
  results: PaymentRow[];
  nextCursor: number | null;
}

export interface CustomerHit {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  canOrder: boolean;
  status: string;
}

export interface CatalogSku {
  id: number;
  code: string;
  label: string;
  imageUrl: string | null;
  price: number;
  payable: number;
  quantity: number;
}
export interface CatalogProduct {
  id: number;
  name: string;
  slug: string;
  thumbnailUrl: string | null;
  skus: CatalogSku[];
}

export interface ProofField {
  key: string;
  label: string;
  required: boolean;
}
export interface GatewayOption {
  id: number;
  name: string;
  slug: string;
  type: string;
  typeLabel: string;
  description: string | null;
  iconUrl: string | null;
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
  branchName: string | null;
  proofFields: ProofField[];
}
export interface DeliveryOption {
  deliveryType: DeliveryType;
  charge: number;
  estimatedDays: number;
  supportsLiveAnimal: boolean;
  zoneName: string | null;
  payable: number;
}
export interface OrderOptions {
  countries: { code: string; name: string }[];
  countryCode: string | null;
  countryName: string | null;
  deliveryOptions: DeliveryOption[];
  paymentGateways: GatewayOption[];
}

export interface CreateOrderInput {
  sellerId?: number;
  userId?: number;
  items: { sellerProductId: number; sellerProductSkuId: number; quantity: number }[];
  recipientName: string;
  recipientPhone: string;
  contactEmail?: string;
  countryCode: string;
  state?: string;
  city: string;
  addressLine: string;
  postalCode?: string;
  deliveryType: DeliveryType;
  paymentGatewayId: number;
  note?: string;
  paymentProof?: Record<string, string>;
}
