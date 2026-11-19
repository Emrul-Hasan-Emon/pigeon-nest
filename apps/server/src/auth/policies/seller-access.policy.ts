import { Seller } from '../../database/entities/seller/seller.entity';
import { SellerActiveStatus } from '../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../database/enums/seller-status.enum';

export type SellerAccessLevel = 'any' | 'profile' | 'full';

export type SellerAccessCode =
  | 'SELLER_PENDING'
  | 'SELLER_REJECTED'
  | 'SELLER_INACTIVE'
  | 'SELLER_SUSPENDED';

export interface SellerAccess {
  // Edit own profile / password.
  canEditProfile: boolean;
  // Everything else (catalog, orders, ...).
  canManage: boolean;
  code: SellerAccessCode | null;
  reason: string | null;
}

// The single source of truth for what a seller may do:
//   approved + active           -> everything
//   pending / rejected / inactive -> profile changes only
//   suspended (any status)      -> nothing
export function getSellerAccess(
  seller: Pick<Seller, 'status' | 'activeStatus'>,
): SellerAccess {
  if (seller.activeStatus === SellerActiveStatus.SUSPENDED) {
    return {
      canEditProfile: false,
      canManage: false,
      code: 'SELLER_SUSPENDED',
      reason: 'Your account is suspended. Please contact support.',
    };
  }
  if (
    seller.status === SellerStatus.APPROVED &&
    seller.activeStatus === SellerActiveStatus.ACTIVE
  ) {
    return { canEditProfile: true, canManage: true, code: null, reason: null };
  }
  if (seller.status === SellerStatus.PENDING) {
    return {
      canEditProfile: true,
      canManage: false,
      code: 'SELLER_PENDING',
      reason:
        'Your registration is pending approval. You can update your profile until then.',
    };
  }
  if (seller.status === SellerStatus.REJECTED) {
    return {
      canEditProfile: true,
      canManage: false,
      code: 'SELLER_REJECTED',
      reason:
        'Your registration was rejected. Update your profile to resubmit it for review.',
    };
  }
  return {
    canEditProfile: true,
    canManage: false,
    code: 'SELLER_INACTIVE',
    reason: 'Your account is inactive. You can update your profile only.',
  };
}
