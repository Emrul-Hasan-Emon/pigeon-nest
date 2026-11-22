'use client';

import { useEffect } from 'react';
import { MyProposals } from '@/components/store/my-proposals';
import { Breadcrumb, Container } from '@/components/store/page-parts';

export default function ProposalsPage() {
  useEffect(() => {
    document.title = 'Your offers | Pigeon Nest';
  }, []);

  return (
    <Container className="max-w-4xl">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Your offers' }]} />
      <h1 className="font-display mb-1 text-2xl font-semibold text-st-ink sm:text-3xl">Your offers</h1>
      <p className="mb-4 text-sm text-st-slate">Prices you proposed to sellers. Only you and the seller can see them.</p>
      <MyProposals />
    </Container>
  );
}
