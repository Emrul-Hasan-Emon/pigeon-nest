'use client';

import { useParams } from 'next/navigation';
import { AdminProposalDetail } from '@/components/admin/proposals/proposal-detail';

export default function AdminProposalPage() {
  const params = useParams<{ id: string }>();
  return <AdminProposalDetail id={Number(params.id)} />;
}
