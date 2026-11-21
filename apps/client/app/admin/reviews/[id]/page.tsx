'use client';

import { useParams } from 'next/navigation';
import { AdminReviewDetail } from '@/components/admin/reviews/review-detail';

export default function AdminReviewPage() {
  const params = useParams<{ id: string }>();
  return <AdminReviewDetail id={Number(params.id)} />;
}
