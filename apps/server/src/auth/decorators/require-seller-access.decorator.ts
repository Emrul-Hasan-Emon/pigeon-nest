import { SetMetadata } from '@nestjs/common';
import { SellerAccessLevel } from '../policies/seller-access.policy';

export const SELLER_ACCESS_KEY = 'sellerAccess';

// 'any'     any seller, even suspended (read own status)
// 'profile' sellers allowed to edit their profile (not suspended)
// 'full'    approved + active sellers (the default when omitted)
export const RequireSellerAccess = (level: SellerAccessLevel) =>
  SetMetadata(SELLER_ACCESS_KEY, level);
