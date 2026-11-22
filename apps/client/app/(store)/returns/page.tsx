'use client';

import { useEffect } from 'react';
import { MyReturns } from '@/components/store/my-returns';
import { Breadcrumb, Container } from '@/components/store/page-parts';

export default function ReturnsPage() {
  useEffect(() => {
    document.title = 'Your returns | Pigeon Nest';
  }, []);
  return (
    <Container className="max-w-4xl">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Your returns' }]} />
      <h1 className="font-display mb-1 text-2xl font-semibold text-st-ink sm:text-3xl">Your returns</h1>
      <p className="mb-4 text-sm text-st-slate">Orders and items you asked to send back, and where the refund is.</p>
      <MyReturns />
    </Container>
  );
}
