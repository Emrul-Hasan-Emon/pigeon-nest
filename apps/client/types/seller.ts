export type SellerStatus = 'pending' | 'approved' | 'rejected';
export type SellerActiveStatus = 'active' | 'inactive' | 'suspended';

export type SellerAccessCode =
  | 'SELLER_PENDING'
  | 'SELLER_REJECTED'
  | 'SELLER_INACTIVE'
  | 'SELLER_SUSPENDED';

/** What a seller may currently do; computed by the server. */
export interface SellerAccess {
  canEditProfile: boolean;
  canManage: boolean;
  code: SellerAccessCode | null;
  reason: string | null;
}

export interface Seller {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  avatarPath: string | null;
  nidFrontImageUrl: string | null;
  nidFrontImagePath: string | null;
  nidBackImageUrl: string | null;
  nidBackImagePath: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  status: SellerStatus;
  commissionRate: number;
  payoutAccountInfo: Record<string, unknown> | null;
  activeStatus: SellerActiveStatus;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SellerListResponse {
  results: Seller[];
  nextCursor: number | null;
}

export interface SellerListParams {
  search?: string;
  status?: SellerStatus;
  activeStatus?: SellerActiveStatus;
  cursor?: number;
  limit?: number;
}

/** A seller as returned to the seller themself (adds the access flags). */
export interface SellerView extends Seller {
  access: SellerAccess;
}

export interface SellerLoginResponse {
  accessToken: string;
  seller: SellerView;
}

export type SellerStatusChangeAction =
  | 'baseline'
  | 'registered'
  | 'admin_created'
  | 'approved'
  | 'rejected'
  | 'resubmitted'
  | 'admin_updated';

/** One row of the append-only status log. Admin-only. */
export interface SellerStatusHistoryEntry {
  id: number;
  sellerId: number;
  seller: { id: number; name: string; phone: string | null; email: string | null } | null;
  fromStatus: SellerStatus | null;
  toStatus: SellerStatus;
  fromActiveStatus: SellerActiveStatus | null;
  toActiveStatus: SellerActiveStatus;
  action: SellerStatusChangeAction;
  reason: string | null;
  createdBy: number | null;
  creatorType: 'admin' | 'seller' | 'user' | null;
  creatorName: string | null;
  createdAt: string;
}

export interface SellerStatusHistoryParams {
  search?: string;
  sellerId?: number;
  action?: SellerStatusChangeAction;
  toStatus?: SellerStatus;
  toActiveStatus?: SellerActiveStatus;
  cursor?: number;
  limit?: number;
}

export interface SellerStatusHistoryResponse {
  results: SellerStatusHistoryEntry[];
  nextCursor: number | null;
}
