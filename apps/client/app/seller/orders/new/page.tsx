'use client';

import { CreateOrderForm } from '@/components/orders/create-order';
import { SellerShell } from '@/components/orders/ui';

export default function CreateOrderFormPage() {
  return <SellerShell active="orders"><CreateOrderForm role="seller" /></SellerShell>;
}
