'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SellerSidebar } from '@/components/seller/seller-sidebar';
import { StatusBanner } from '@/components/seller/status-banner';
import { getSellerDashboard, type SellerDashboardSummary } from '@/lib/api/seller-products';
import { getMyProfile } from '@/lib/api/seller-portal';
import { ApiError } from '@/lib/api/http';
import { clearSellerToken, getSellerToken } from '@/lib/auth/seller-token';
import type { SellerView } from '@/types/seller';

type Tone = 'default' | 'good' | 'warn' | 'bad';

const TONES: Record<Tone, string> = {
  default: 'text-foreground',
  good: 'text-emerald-600',
  warn: 'text-amber-600',
  bad: 'text-red-600',
};

function Stat({
  label,
  value,
  tone = 'default',
  href,
}: {
  label: string;
  value: number;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${TONES[tone]}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-base font-semibold text-foreground">{title}</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export default function SellerDashboardPage() {
  const router = useRouter();
  const [seller, setSeller] = useState<SellerView | null>(null);
  const [summary, setSummary] = useState<SellerDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!getSellerToken()) {
      router.replace('/seller/login');
      return;
    }
    async function load() {
      try {
        const profile = await getMyProfile();
        setSeller(profile);
        // Numbers are only available to approved + active sellers.
        if (profile.access.canManage) {
          setSummary(await getSellerDashboard());
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearSellerToken();
          router.replace('/seller/login');
          return;
        }
        setFailed(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  return (
    <div className="min-h-screen bg-background pl-56">
      <SellerSidebar active="dashboard" />
      <main className="mx-auto max-w-5xl px-6 py-6">
        <h1 className="mb-1 text-2xl font-bold text-foreground">
          {seller ? `Welcome, ${seller.name}` : 'Dashboard'}
        </h1>
        <p className="mb-5 text-sm text-muted-foreground">A summary of your products.</p>

        {loading && <p className="py-10 text-center text-muted-foreground">Loading…</p>}
        {failed && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Failed to load the dashboard.
          </p>
        )}
        {seller && !summary && !loading && <StatusBanner seller={seller} />}

        {summary && (
          <>
            {summary.lockedProducts > 0 && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="status">
                {summary.lockedProducts} of your products {summary.lockedProducts === 1 ? 'is' : 'are'} rejected or
                suspended by an admin and cannot be changed.{' '}
                <Link href="/seller/products" className="font-medium underline">
                  Review them
                </Link>
              </div>
            )}

            <Section title="Overview">
              <Stat label="Total products" value={summary.totalProducts} href="/seller/products" />
              <Stat label="Visible on storefront" value={summary.visibleProducts} tone="good" />
              <Stat label="Locked by admin" value={summary.lockedProducts} tone={summary.lockedProducts ? 'bad' : 'default'} />
              <Stat label="Total SKUs" value={summary.totalSkus} />
            </Section>

            <Section title="By status">
              <Stat label="Approved" value={summary.status.approved} tone="good" />
              <Stat label="Pending" value={summary.status.pending} tone="warn" />
              <Stat label="Rejected" value={summary.status.rejected} tone={summary.status.rejected ? 'bad' : 'default'} />
            </Section>

            <Section title="By activity">
              <Stat label="Active" value={summary.activeStatus.active} tone="good" />
              <Stat label="Inactive" value={summary.activeStatus.inactive} />
              <Stat label="Suspended" value={summary.activeStatus.suspended} tone={summary.activeStatus.suspended ? 'bad' : 'default'} />
            </Section>

            <Section title="Stock">
              <Stat label="Out-of-stock SKUs" value={summary.outOfStockSkus} tone={summary.outOfStockSkus ? 'warn' : 'default'} />
            </Section>
          </>
        )}
      </main>
    </div>
  );
}
