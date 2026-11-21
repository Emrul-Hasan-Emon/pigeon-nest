'use client';

import Link from 'next/link';
import { ReportQueue } from '@/components/admin/reviews/report-queue';

export default function AdminReviewReportsPage() {
  return (
    <div>
      <Link href="/admin/reviews" className="text-sm text-primary hover:underline">← All reviews</Link>
      <div className="mb-4 mt-2">
        <h1 className="text-2xl font-bold text-foreground">Review reports</h1>
        <p className="text-sm text-muted-foreground">Customers and sellers flag reviews and replies here. Hide what breaks the rules; dismiss the rest.</p>
      </div>
      <ReportQueue />
    </div>
  );
}
