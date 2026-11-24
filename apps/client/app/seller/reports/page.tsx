'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SellerFrame } from '@/components/seller/seller-frame';
import { ReportView } from '@/components/reports/report-view';
import { getSellerReport } from '@/lib/api/reports';
import { ApiError } from '@/lib/api/http';
import { clearSellerToken, getSellerToken } from '@/lib/auth/seller-token';
import type { ReportName, ReportParams } from '@/types/report';

export default function SellerReportsPage() {
  const router = useRouter();
  const load = useCallback(
    async (name: ReportName, params: ReportParams) => {
      if (!getSellerToken()) {
        router.replace('/seller/login');
        throw new ApiError(401, 'Please sign in again.');
      }
      try {
        return await getSellerReport(name, { ...params, sellerId: undefined });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearSellerToken();
          router.replace('/seller/login');
        }
        throw error;
      }
    },
    [router],
  );

  return (
    <SellerFrame active="reports" width="max-w-6xl">
      <h1 className="mb-1 text-foreground">Reports</h1>
      <p className="mb-5 text-base text-muted-foreground">Pick a report and the dates. Read it here, or press Download CSV to open it in Excel or Google Sheets.</p>
      <ReportView mine load={load} fileBase="my-shop" />
    </SellerFrame>
  );
}
