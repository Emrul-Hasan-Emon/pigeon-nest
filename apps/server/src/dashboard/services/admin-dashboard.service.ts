import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { tidy } from '../../shared/utils/money.util';
import { DashboardQueryDto } from '../dtos/dashboard.dtos';
import { resolveWindow } from '../utils/dashboard-window.util';
import { DashboardMetricsService } from './dashboard-metrics.service';

/** The admin's landing page: the whole platform for one period, and what needs an admin's attention now. */
@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly metrics: DashboardMetricsService,
    private readonly dataSource: DataSource,
  ) {}

  async overview(query: DashboardQueryDto) {
    const w = resolveWindow(query.range);
    const [totals, series, ordersByStatus, topProducts, topSellers, people, attention, balances] = await Promise.all([
      this.metrics.compare(null, w),
      this.metrics.series(null, w),
      this.metrics.ordersByStatus(null, w.from, w.to),
      this.metrics.topProducts(null, w.from, w.to),
      this.topSellers(w.from, w.to),
      this.people(w.from, w.to),
      this.attention(),
      this.commissionBalances(),
    ]);
    return { range: w.range, from: w.from, to: w.to, bucket: w.bucket, totals, series, ordersByStatus, topProducts, topSellers, people, attention, balances };
  }

  /** Sellers ranked by sales in the period. */
  private topSellers(from: Date, to: Date) {
    return this.dataSource.query<{ id: number; name: string; orders: number; grossSales: number; commission: number }[]>(
      `select o."sellerId" id, s.name, count(*)::int orders,
              round(sum(o."payableAmount")::numeric, 2)::float "grossSales", round(sum(o."systemCommission")::numeric, 2)::float commission
         from "order" o join seller s on s.id = o."sellerId"
        where o."deletedAt" is null and o."paymentStatus" = 'paid' and o.status <> 'cancelled' and o."createdAt" >= $1 and o."createdAt" < $2
        group by o."sellerId", s.name order by "grossSales" desc limit 5`,
      [from, to],
    );
  }

  /** Customers and sellers: new in the period, and in total. */
  private async people(from: Date, to: Date) {
    const [r] = await this.dataSource.query<Record<string, string>[]>(
      `select (select count(*) from "user" where "deletedAt" is null and "createdAt" >= $1 and "createdAt" < $2) new_customers,
              (select count(*) from "user" where "deletedAt" is null) customers,
              (select count(*) from seller where "deletedAt" is null and "createdAt" >= $1 and "createdAt" < $2) new_sellers,
              (select count(*) from seller where "deletedAt" is null) sellers,
              (select count(*) from seller where "deletedAt" is null and status = 'approved' and "activeStatus" = 'active') active_sellers,
              (select count(*) from seller_product where "deletedAt" is null and status = 'approved' and "activeStatus" = 'active') live_products`,
      [from, to],
    );
    return {
      newCustomers: Number(r.new_customers),
      customers: Number(r.customers),
      newSellers: Number(r.new_sellers),
      sellers: Number(r.sellers),
      activeSellers: Number(r.active_sellers),
      liveProducts: Number(r.live_products),
    };
  }

  /** Work waiting for an admin right now, whatever the period. Cheap: the console polls it for its alert bell. */
  async attention() {
    const [r] = await this.dataSource.query<Record<string, string>[]>(
      `select (select count(*) from seller where "deletedAt" is null and status = 'pending') pending_sellers,
              (select count(*) from seller_product where "deletedAt" is null and status = 'pending') pending_products,
              (select count(*) from "order" where "deletedAt" is null and status = 'delivered' and "paymentStatus" <> 'paid') delivered_unpaid,
              (select count(*) from review_report where "deletedAt" is null and status = 'open') review_reports`,
    );
    const returns = await this.metrics.returnsInFlight(null);
    return {
      pendingSellers: Number(r.pending_sellers),
      pendingProducts: Number(r.pending_products),
      deliveredUnpaid: Number(r.delivered_unpaid),
      reviewReports: Number(r.review_reports),
      returnRequests: returns.requested,
      returnsInProgress: returns.inProgress,
    };
  }

  /** What sellers owe the platform right now: the sum of every seller's commission balance. */
  private async commissionBalances() {
    const [r] = await this.dataSource.query<Record<string, string>[]>(
      `select coalesce(sum("totalCommission"), 0) total, coalesce(sum("dueCommission"), 0) due, coalesce(sum("paidCommission"), 0) paid,
              count(*) filter (where "dueCommission" > 0) sellers_owing
         from system_commission`,
    );
    return { total: tidy(Number(r.total)), due: tidy(Number(r.due)), paid: tidy(Number(r.paid)), sellersOwing: Number(r.sellers_owing) };
  }
}
