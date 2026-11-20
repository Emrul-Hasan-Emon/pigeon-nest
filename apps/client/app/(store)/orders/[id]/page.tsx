'use client';

import { useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Breadcrumb, Container } from '@/components/store/page-parts';
import { MyOrderDetail } from '@/components/store/my-order-detail';

export default function MyOrderPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  useEffect(() => {
    document.title = 'Your order | Pigeon Nest';
  }, []);
  return (
    <Container className="max-w-4xl">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Your orders', href: '/orders' }, { label: 'Order' }]} />
      <MyOrderDetail id={Number(params.id)} placed={search.get('placed') === '1'} />
    </Container>
  );
}
