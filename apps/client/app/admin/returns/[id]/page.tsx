'use client';

import { useParams } from 'next/navigation';
import { ReturnDetailView } from '@/components/returns/return-detail';

export default function AdminReturnPage() {
  const params = useParams<{ id: string }>();
  return <ReturnDetailView role="admin" id={Number(params.id)} />;
}
