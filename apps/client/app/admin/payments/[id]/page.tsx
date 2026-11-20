'use client';

import { useParams } from 'next/navigation';
import { PaymentDetailView } from '@/components/orders/payment-detail';

export default function PaymentDetailPage() {
  const params = useParams<{ id: string }>();
  return <PaymentDetailView role="admin" id={Number(params.id)} />;
}
