'use client';

import { OrderList } from '@/components/orders/order-list';
import { SellerShell } from '@/components/orders/ui';

export default function OrderListPage() {
  return <SellerShell active="orders"><OrderList role="seller" /></SellerShell>;
}
