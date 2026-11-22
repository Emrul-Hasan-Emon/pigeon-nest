'use client';

import { Suspense, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Breadcrumb, Container } from '@/components/store/page-parts';
import { MyReturnDetail } from '@/components/store/my-return-detail';

function Content() {
  const params = useParams<{ id: string }>();
  const q = useSearchParams();
  return <MyReturnDetail id={Number(params.id)} justOpened={q.get('opened') === '1'} />;
}

export default function ReturnPage() {
  useEffect(() => {
    document.title = 'Your return | Pigeon Nest';
  }, []);
  return (
    <Container className="max-w-4xl">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Your returns', href: '/returns' }, { label: 'Return' }]} />
      <Suspense fallback={<div className="store-skeleton h-64 rounded-xl bg-st-line" aria-busy="true" />}>
        <Content />
      </Suspense>
    </Container>
  );
}
