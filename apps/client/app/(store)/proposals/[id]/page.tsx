'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Breadcrumb, Container } from '@/components/store/page-parts';
import { MyProposalDetail } from '@/components/store/my-proposal-detail';

export default function ProposalPage() {
  const params = useParams<{ id: string }>();
  useEffect(() => {
    document.title = 'Your offer | Pigeon Nest';
  }, []);
  return (
    <Container className="max-w-4xl">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Your offers', href: '/proposals' }, { label: 'Offer' }]} />
      <MyProposalDetail id={Number(params.id)} />
    </Container>
  );
}
