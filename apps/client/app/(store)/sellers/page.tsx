'use client';

import { Suspense, useEffect } from 'react';
import { Breadcrumb, Container } from '@/components/store/page-parts';
import { SellerListing } from '@/components/store/seller-listing';

export default function SellersPage() {
  useEffect(() => {
    document.title = 'Sellers | Pigeon Nest';
  }, []);

  return (
    <Container>
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Sellers' }]} />
      <h1 className="font-display mb-4 text-2xl font-semibold text-st-ink sm:text-3xl">Sellers</h1>
      <Suspense>
        <SellerListing />
      </Suspense>
    </Container>
  );
}
