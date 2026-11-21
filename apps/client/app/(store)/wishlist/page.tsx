'use client';

import { useEffect } from 'react';
import { WishlistList } from '@/components/store/wishlist-list';
import { Breadcrumb, Container } from '@/components/store/page-parts';

export default function WishlistPage() {
  useEffect(() => {
    document.title = 'Your wishlist | Pigeon Nest';
  }, []);

  return (
    <Container className="max-w-4xl">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Your wishlist' }]} />
      <h1 className="font-display mb-1 text-2xl font-semibold text-st-ink sm:text-3xl">Your wishlist</h1>
      <WishlistList />
    </Container>
  );
}
