'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SellerFrame } from '@/components/seller/seller-frame';
import { StatusBanner } from '@/components/seller/status-banner';
import { SellerOverviewView } from '@/components/dashboard/seller-overview';
import { getMyProfile } from '@/lib/api/seller-portal';
import { ApiError } from '@/lib/api/http';
import { clearSellerToken, getSellerToken } from '@/lib/auth/seller-token';
import type { SellerView } from '@/types/seller';
import { LoadingBlock } from '@/components/ui/skeleton';

// The page only checks who is signed in and whether the account may sell. Every dashboard figure comes
// from one call, made by SellerOverviewView.
export default function SellerDashboardPage() {
  const router = useRouter();
  const [seller, setSeller] = useState<SellerView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!getSellerToken()) {
      router.replace('/seller/login');
      return;
    }
    getMyProfile()
      .then(setSeller)
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          clearSellerToken();
          router.replace('/seller/login');
          return;
        }
        setFailed(true);
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <SellerFrame active="dashboard" width="max-w-6xl">
        {!seller?.access.canManage && (
          <>
            <h1 className="mb-1 text-[1.75rem] leading-tight text-foreground">{seller ? `Welcome, ${seller.name}` : 'Dashboard'}</h1>
            <p className="mb-5 text-sm text-muted-foreground">Your sales, what needs doing, and a summary of your products.</p>
          </>
        )}

        {loading && <LoadingBlock />}
        {failed && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">Failed to load the dashboard.</p>}
        {/* Numbers are only available to approved and active sellers. */}
        {seller && !seller.access.canManage && !loading && <StatusBanner seller={seller} />}
        {seller?.access.canManage && <SellerOverviewView title={`Welcome, ${seller.name}`} />}
    </SellerFrame>
  );
}
