import type { LineProposal } from './proposal';

export type CartLineStatus = 'ok' | 'unavailable' | 'out_of_stock' | 'insufficient_stock';

export interface CartLine {
  id: number;
  product: { id: number; name: string; slug: string; thumbnailUrl: string | null } | null;
  sku: { id: number; code: string; imageUrl: string | null; label: string; bird?: { ringNumber: string | null; hatchDate: string | null; breed: string | null } | null } | null;
  quantity: number;
  unitPrice: number;
  unitPayable: number;
  linePayable: number;
  availableQuantity: number;
  status: CartLineStatus;
  priceChanged: boolean;
  previousUnitPayable: number;
  /** The live SKU price, whatever the line pays. */
  skuUnitPayable: number;
  /** Bought at an accepted price proposal. applied is false when the SKU is now cheaper. */
  proposal: LineProposal | null;
  /** Why a proposal no longer applies, or that the SKU got cheaper than it. */
  proposalNotice: string | null;
}

export interface Cart {
  id: number;
  isActive: boolean;
  seller: { id: number; name: string; avatarUrl: string | null };
  lines: CartLine[];
  totals: { itemCount: number; listTotal: number; payableTotal: number; savings: number };
  canCheckout: boolean;
  issues: string[];
  /** Messages that do not block checkout (proposal changes). */
  notices: string[];
  updatedAt: string;
}

export interface CartResult {
  cart: Cart | null;
  notice: string | null;
}

export interface CartSummary {
  cartCount: number;
  itemCount: number;
}

export interface CartList {
  carts: Cart[];
  summary: CartSummary;
}

export interface SellerCartResponse {
  seller: { id: number; name: string; avatarUrl: string | null };
  cart: Cart | null;
}

// ---- admin ----
export interface AdminCartOwner {
  type: 'customer' | 'guest';
  user: { id: number; name: string; email: string | null; phone: string } | null;
  sessionId: string | null;
}

export interface AdminCartRow {
  id: number;
  isActive: boolean;
  owner: AdminCartOwner;
  seller: { id: number; name: string };
  lineCount: number;
  itemCount: number;
  listTotal: number;
  payableTotal: number;
  order: { id: number; orderNumber: string | null; status: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCartListResponse {
  results: AdminCartRow[];
  nextCursor: number | null;
}

export interface AdminCartListParams {
  state?: 'active' | 'inactive';
  sellerSearch?: string;
  customerSearch?: string;
  owner?: 'customer' | 'guest';
  orderNumber?: string;
  hasItems?: boolean;
  minTotal?: number;
  maxTotal?: number;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  cursor?: number;
  limit?: number;
}

export interface AdminCartLine {
  id: number;
  product: { id: number; name: string; slug: string; thumbnailUrl: string | null } | null;
  sku: { id: number; code: string; imageUrl: string | null; label?: string } | null;
  quantity: number;
  unitPrice: number;
  unitPayable: number;
  linePayable: number;
  status?: CartLineStatus;
  availableQuantity?: number;
  priceChanged?: boolean;
  skuUnitPayable?: number;
  proposal?: LineProposal | null;
}

export interface AdminCartDetail {
  id: number;
  isActive: boolean;
  owner: AdminCartOwner;
  seller: { id: number; name: string; avatarUrl: string | null };
  order: { id: number; orderNumber: string | null; status: string | null } | null;
  mode: 'live' | 'snapshot';
  lines: AdminCartLine[];
  totals: { itemCount: number; listTotal: number; payableTotal: number; savings: number };
  canCheckout: boolean | null;
  issues: string[];
  createdAt: string;
  updatedAt: string;
}
