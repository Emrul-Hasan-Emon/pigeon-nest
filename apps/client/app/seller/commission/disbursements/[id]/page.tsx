'use client';

import { useParams } from 'next/navigation';
import { DisburseDetailView } from '@/components/commission/disburse-detail';
import { SellerShell } from '@/components/orders/ui';

export default function SellerCommissionPaymentPage() {
  const params = useParams<{ id: string }>();
  return <SellerShell active="commission"><DisburseDetailView role="seller" id={Number(params.id)} /></SellerShell>;
}
