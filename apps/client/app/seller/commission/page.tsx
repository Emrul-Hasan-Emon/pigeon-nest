'use client';

import { SellerCommissionSelf } from '@/components/commission/seller-commission-self';
import { SellerShell } from '@/components/orders/ui';

export default function SellerCommissionPage() {
  return <SellerShell active="commission"><SellerCommissionSelf /></SellerShell>;
}
