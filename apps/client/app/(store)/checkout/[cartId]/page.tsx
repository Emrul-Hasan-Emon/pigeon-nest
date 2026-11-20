'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Breadcrumb, Container } from '@/components/store/page-parts';
import { CheckoutForm } from '@/components/store/checkout-form';

export default function CheckoutPage() {
  const params = useParams<{ cartId: string }>();
  useEffect(() => {
    document.title = 'Checkout | Pigeon Nest';
  }, []);
  return (
    <Container>
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Your carts', href: '/cart' }, { label: 'Checkout' }]} />
      <h1 className="font-display mb-4 text-2xl font-semibold text-st-ink sm:text-3xl">Checkout</h1>
      <CheckoutForm cartId={Number(params.cartId)} />
    </Container>
  );
}
