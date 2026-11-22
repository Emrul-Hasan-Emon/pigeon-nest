'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminCreateReturn } from '@/components/returns/create-return';

function Content() {
  const q = useSearchParams();
  const n = Number(q.get('orderId'));
  return <AdminCreateReturn initialOrderId={Number.isInteger(n) && n > 0 ? n : undefined} />;
}

export default function AdminNewReturnPage() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-muted-foreground">Loading…</p>}>
      <Content />
    </Suspense>
  );
}
