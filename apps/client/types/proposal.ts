export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'used';
export type ProposalParty = 'buyer' | 'seller';
export type ProposalActionName = 'accept' | 'counter' | 'reject' | 'cancel';
export type ProposalHistoryAction = 'created' | 'countered' | 'accepted' | 'rejected' | 'cancelled' | 'used';

export interface ProposalHistoryEntry {
  id: number;
  action: ProposalHistoryAction;
  actorType: 'user' | 'seller' | 'admin';
  actorId: number | null;
  actorName: string | null;
  price: number;
  quantity: number;
  skuPriceAtTime: number;
  note: string | null;
  createdAt: string;
}

/** One proposal, the same for buyer, seller and admin. `actions` is what the viewer may do now. */
export interface Proposal {
  id: number;
  status: ProposalStatus;
  awaitingParty: ProposalParty | null;
  quantity: number;
  /** Per unit: the latest figure, the agreed one once accepted. */
  price: number;
  total: number;
  skuPriceAtCreate: number;
  skuPriceNow: number;
  /** The SKU is now cheaper than an open proposal: the buyer pays the lower price. */
  skuPriceNowLower: boolean;
  stock: number;
  buyer: { id: number; name: string };
  seller: { id: number; name: string };
  product: { id: number; name: string; slug: string; thumbnailUrl: string | null };
  sku: { id: number; sku: string | null; label: string | null; imageUrl: string | null };
  closedByType: 'user' | 'seller' | 'admin' | null;
  closeNote: string | null;
  acceptedAt: string | null;
  usedAt: string | null;
  orderId: number | null;
  createdAt: string;
  updatedAt: string;
  actions: ProposalActionName[];
}

export interface ProposalDetail extends Proposal {
  history: ProposalHistoryEntry[];
}

export interface ProposalPage {
  results: Proposal[];
  nextCursor: number | null;
}

export interface ProposalListParams {
  status?: ProposalStatus;
  awaiting?: ProposalParty;
  sellerProductSkuId?: number;
  productId?: number;
  search?: string;
  buyerSearch?: string;
  sellerSearch?: string;
  userId?: number;
  sellerId?: number;
  cursor?: number;
  limit?: number;
}

export interface SellerProposalSummary {
  pending: number;
  awaitingYou: number;
  accepted: number;
  used: number;
  closed: number;
}

export interface CreateProposalInput {
  sellerProductSkuId: number;
  quantity: number;
  price: number;
  note?: string;
}

export interface ProposalNoteInput {
  note?: string;
}

export interface CounterProposalInput {
  price: number;
  quantity?: number;
  note?: string;
}

/** What a cart or order line says about the proposal it was bought at. */
export interface LineProposal {
  id: number;
  unitPrice: number;
  applied?: boolean;
  lineTotal?: number | null;
}
