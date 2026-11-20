'use client';

import { Suspense, useEffect } from 'react';
import { Breadcrumb, Container } from '@/components/store/page-parts';
import { ProductListing } from '@/components/store/product-listing';

export default function ProductsPage() {
  useEffect(() => {
    document.title = 'All products | Pigeon Nest';
  }, []);

  return (
    <Container>
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'All products' }]} />
      <h1 className="font-display mb-4 text-2xl font-semibold text-st-ink sm:text-3xl">All products</h1>
      <Suspense>
        <ProductListing showCategoryFilter showCollectionFilter />
      </Suspense>
    </Container>
  );
}
