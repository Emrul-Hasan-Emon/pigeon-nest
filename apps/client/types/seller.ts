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
