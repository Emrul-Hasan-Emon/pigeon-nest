'use client';

import { useParams } from 'next/navigation';
import { DisburseDetailView } from '@/components/commission/disburse-detail';

export default function CommissionPaymentPage() {
  const params = useParams<{ id: string }>();
  return <DisburseDetailView role="admin" id={Number(params.id)} />;
}
