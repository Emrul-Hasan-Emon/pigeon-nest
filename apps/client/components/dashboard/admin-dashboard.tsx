'use client';

import { useEffect, useState } from 'react';
import { getAdminDashboard } from '@/lib/api/dashboard';
import { ApiError } from '@/lib/api/http';
import type { AdminDashboard as Data, DashboardRange } from '@/types/dashboard';
import { adminTodoItems } from './admin-todo';
import { DashboardSkeleton } from './dashboard-skeleton';
import { DashboardHeader, Definition, HeroKpi, Panel, Ranking, rangeLabel, SalesChart, StatStrip, StatusBars, taka, Todo } from './parts';

export function AdminDashboardView() {
  const [range, setRange] = useState<DashboardRange>('30d');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getAdminDashboard(range)
      .then((d) => live && (setData(d), setError(null)))
      .catch((e) => live && setError(e instanceof ApiError ? e.message : 'Failed to load the dashboard.'));
    return () => {
      live = false;
    };
  }, [range]);

  const t = data?.totals;
  return (
    <div>
      <DashboardHeader
        title="Dashboard"
        subtitle="Sales, returns and commission across the whole marketplace."
        guideHref="/admin/dashboard/guide"
        period={data ? rangeLabel(data.from, data.to) : ' '}
        range={range}
        onRange={setRange}
      />

      {error && <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {!data && !error && <DashboardSkeleton />}

      {data && t && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-3">
            <HeroKpi
              label="Net sales"
              value={taka(t.netSales)}
              change={t.change.netSales}
              note="Nothing to compare with yet"
              support={[
                { label: 'Sales', value: taka(t.grossSales) },
                { label: 'Refunds', value: `${taka(t.refunds.amount)} (${t.refunds.count})` },
                { label: 'Commission earned', value: taka(t.commission.net) },
              ]}
            />
            <Panel title="Sales over time" note="Sales and refunds, day by day." className="lg:col-span-2">
              <SalesChart series={data.series} bucket={data.bucket} />
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
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
                  { label: 'Earned this period', value: taka(t.commission.net), change: t.change.netCommission },
                  { label: 'Owed by sellers', value: taka(data.balances.due), hint: `${data.balances.sellersOwing} ${data.balances.sellersOwing === 1 ? 'seller' : 'sellers'} owing` },
                  { label: 'Paid in so far', value: taka(data.balances.paid), hint: `${taka(data.balances.total)} earned in total` },
                ]}
              />
            </div>
            <Panel title="Needs attention" note="Right now, whatever the period.">
              <Todo items={adminTodoItems(data.attention)} />
            </Panel>
          </div>

          <StatStrip
            title="Marketplace"
            stats={[
              { label: 'Customers', value: String(data.people.customers), hint: `${data.people.newCustomers} new in this period` },
              { label: 'Sellers', value: String(data.people.sellers), hint: `${data.people.newSellers} new · ${data.people.activeSellers} active` },
              { label: 'Live products', value: String(data.people.liveProducts), hint: 'Approved and active' },
            ]}
          />

          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="Orders by status" note="Orders placed in this period.">
              <StatusBars items={data.ordersByStatus} />
            </Panel>
            <Panel title="Top sellers" note="By sales in this period.">
              <Ranking
                empty="No sales in this period."
                rows={data.topSellers.map((s) => ({ key: s.id, name: s.name, detail: `${s.orders} paid ${s.orders === 1 ? 'order' : 'orders'} · commission ${taka(s.commission)}`, amount: s.grossSales, href: `/admin/sellers/${s.id}` }))}
              />
            </Panel>
            <Panel title="Top products" note="By sales, returned items left out.">
              <Ranking empty="No sales in this period." rows={data.topProducts.map((p) => ({ key: p.id, name: p.name, detail: `${p.units} sold`, amount: p.revenue }))} />
            </Panel>
          </div>
          <Definition />
        </div>
      )}
    </div>
  );
}
