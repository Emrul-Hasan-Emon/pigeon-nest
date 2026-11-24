'use client';

import { useEffect, useState } from 'react';
import { ReportView } from '@/components/reports/report-view';
import { getAdminReport } from '@/lib/api/reports';
import { listSellers } from '@/lib/api/sellers';

export default function AdminReportsPage() {
  const [sellers, setSellers] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    // The list only fills the seller picker. If it fails the reports still work for all sellers.
    listSellers({ status: 'approved', limit: 100 })
      .then((r) => setSellers(r.results.map((s) => ({ id: s.id, name: s.name }))))
      .catch(() => setSellers([]));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Reports</h1>
      <p className="mb-5 text-sm text-muted-foreground">Sales, products, orders and earnings for the whole marketplace, or for one seller. Press Download CSV to open a report in Excel or Google Sheets.</p>
      <ReportView mine={false} load={getAdminReport} sellers={sellers} fileBase="marketplace" />
    </div>
  );
}
