'use client';

import { Suspense, useEffect } from 'react';
import { MyReviews } from '@/components/store/my-reviews';
import { Breadcrumb, Container } from '@/components/store/page-parts';

export default function ReviewsPage() {
  useEffect(() => {
    document.title = 'Your reviews | Pigeon Nest';
  }, []);

  return (
    <Container className="max-w-3xl">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Your reviews' }]} />
      <h1 className="font-display mb-1 text-2xl font-semibold text-st-ink sm:text-3xl">Your reviews</h1>
      <p className="mb-4 text-sm text-st-slate">Review what you bought and answer the seller. Your public name shows your first name and last initial only.</p>
      <Suspense fallback={<p className="py-10 text-center text-st-slate">Loading…</p>}>
        <MyReviews />
      </Suspense>
    </Container>
  );
}
