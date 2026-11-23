'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSellerOverview } from '@/lib/api/dashboard';
import { ApiError } from '@/lib/api/http';
import { WishlistInsightsView } from '@/components/wishlist/seller-wishlist-insights';
import type { DashboardRange, SellerOverview as Data } from '@/types/dashboard';
import { sellerTodoItems } from './seller-todo';
import { DashboardSkeleton } from './dashboard-skeleton';
import { ActionTiles, DashboardHeader, Definition, HeroKpi, Panel, Ranking, rangeLabel, SalesChart, StatStrip, StatusBars, taka } from './parts';

/** The whole seller dashboard, from one API call: sales, earnings, to-do list, product counts and wishlist demand. */
export function SellerOverviewView({ title = 'Dashboard' }: { title?: string }) {
  const [range, setRange] = useState<DashboardRange>('30d');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getSellerOverview(range)
      .then((d) => live && (setData(d), setError(null)))
      .catch((e) => live && setError(e instanceof ApiError ? e.message : 'Failed to load your sales.'));
    return () => {
      live = false;
    };
  }, [range]);

  const t = data?.totals;
  return (
    <div>
      <DashboardHeader
        title={title}
        subtitle="Your sales, what needs doing, and a summary of your products."
        guideHref="/seller/dashboard/guide"
        period={data ? rangeLabel(data.from, data.to) : ' '}
        range={range}
        onRange={setRange}
      />
      {error && <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {!data && !error && <DashboardSkeleton />}

      {data && t && (
        <div className="space-y-6">
          <ActionTiles items={sellerTodoItems(data.attention)} />
          <div className="grid gap-5 lg:grid-cols-3">
            <HeroKpi
              label="You keep"
              value={taka(t.sellerEarnings)}
              change={t.change.sellerEarnings}
              note="After commission and refunds"
              spark={data.series.map((p) => p.grossSales - p.refunds)}
              support={[
                { label: 'Sales', value: taka(t.grossSales) },
                { label: 'Commission', value: taka(t.commission.net) },
                { label: 'Refunds', value: `${taka(t.refunds.amount)} (${t.refunds.count})` },
              ]}
            />
            <Panel title="Sales over time" note="Sales and refunds, day by day." className="lg:col-span-2">
              <SalesChart series={data.series} bucket={data.bucket} />
            </Panel>
          </div>

          <div className="space-y-5">
            <div className="space-y-5">
              <StatStrip
                title="Orders"
                stats={[
                  { label: 'Orders placed', value: String(t.orders.placed), change: t.change.orders },
                  { label: 'Paid orders', value: String(t.orders.paid), change: t.change.paidOrders },
                  { label: 'Average order', value: taka(t.averageOrder), change: t.change.averageOrder },
                  { label: 'Return rate', value: `${t.returnRate}%`, hint: 'Of paid orders' },
                ]}
              />
              <StatStrip
                title="Commission"
                stats={[
                  { label: "On this period's sales", value: taka(t.commission.net), change: t.change.netCommission },
                  { label: 'You owe', value: taka(data.balance.due), hint: 'The marketplace, right now' },
                  { label: 'Paid so far', value: taka(data.balance.paid), hint: `${taka(data.balance.total)} charged in total` },
                ]}
              />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="Orders by status" note="Orders placed in this period.">
              <StatusBars items={data.ordersByStatus} />
            </Panel>
            <Panel title="Top products" note="By sales, returned items left out.">
              <Ranking empty="No sales in this period." rows={data.topProducts.map((p) => ({ key: p.id, name: p.name, detail: `${p.units} sold`, amount: p.revenue, href: `/seller/products/${p.id}` }))} />
            </Panel>
            <Panel title="Reviews">
              {data.reviews.count === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews on your products yet.</p>
              ) : (
                <div>
                  <p className="text-3xl font-bold text-foreground">{data.reviews.average?.toFixed(1)} <span className="text-base font-normal text-muted-foreground">out of 5</span></p>
                  <p className="mt-1 text-sm text-muted-foreground">{data.reviews.count} {data.reviews.count === 1 ? 'review' : 'reviews'} on your products</p>
                </div>
              )}
            </Panel>
          </div>
          <Definition />

          <section aria-label="Your products" className="space-y-5 pt-2">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-foreground">Your products</h2>
            {data.products.lockedProducts > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="status">
                {data.products.lockedProducts} of your products {data.products.lockedProducts === 1 ? 'is' : 'are'} rejected or suspended by an admin and cannot be changed.{' '}
                <Link href="/seller/products" className="font-medium underline">Review them</Link>
              </div>
            )}
            <StatStrip
              title="Catalogue"
              stats={[
                { label: 'Total products', value: String(data.products.totalProducts) },
                { label: 'Visible on storefront', value: String(data.products.visibleProducts), tone: 'good' },
                { label: 'Locked by admin', value: String(data.products.lockedProducts), tone: data.products.lockedProducts ? 'bad' : undefined },
                { label: 'Total SKUs', value: String(data.products.totalSkus), hint: data.products.outOfStockSkus ? `${data.products.outOfStockSkus} out of stock` : 'All in stock' },
              ]}
            />
            <div className="grid gap-5 lg:grid-cols-2">
              <StatStrip
                title="Review status"
                stats={[
                  { label: 'Approved', value: String(data.products.status.approved), tone: 'good' },
                  { label: 'Pending', value: String(data.products.status.pending), tone: data.products.status.pending ? 'warn' : undefined },
                  { label: 'Rejected', value: String(data.products.status.rejected), tone: data.products.status.rejected ? 'bad' : undefined },
                ]}
              />
              <StatStrip
                title="Activity"
                stats={[
                  { label: 'Active', value: String(data.products.activeStatus.active), tone: 'good' },
                  { label: 'Inactive', value: String(data.products.activeStatus.inactive) },
                  { label: 'Suspended', value: String(data.products.activeStatus.suspended), tone: data.products.activeStatus.suspended ? 'bad' : undefined },
                ]}
              />
            </div>
            <WishlistInsightsView data={data.wishlist} />
          </section>
        </div>
      )}
    </div>
  );
}
