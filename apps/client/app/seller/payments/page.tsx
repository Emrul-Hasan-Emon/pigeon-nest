'use client';

import { PaymentList } from '@/components/orders/payment-list';
import { SellerShell } from '@/components/orders/ui';

export default function PaymentListPage() {
  return <SellerShell active="payments"><PaymentList role="seller" /></SellerShell>;
}
