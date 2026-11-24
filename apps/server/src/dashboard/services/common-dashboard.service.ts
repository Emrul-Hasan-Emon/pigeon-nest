import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { tidy } from '../../shared/utils/money.util';
import { bucketKeys, DashboardWindow, percentChange } from '../utils/dashboard-window.util';

/** An option counts as low on stock at this many or fewer. The seller dashboard and the low stock report use it. */
export const LOW_STOCK_AT = 5;

/**
 * The queries both dashboards share. Every one takes an optional seller: with a seller it counts only that
 * seller's orders and returns, without one it counts the whole platform.
 *
 * What the numbers mean:
 * - A sale is a fully paid, not cancelled order, counted on the day the order was placed.
 * - Refunds are returns that reached `returned`, counted on the day they were confirmed.
 * - Net sales = sales - refunds. Net commission = commission on those sales - commission taken back by returns.
 */
@Injectable()
export class CommonDashboardService {
  constructor(private readonly dataSource: DataSource) {}

  private q<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<T[]> {
    return this.dataSource.query(sql, params);
  }

  /** Totals for one period. */
  async totals(sellerId: number | null, from: Date, to: Date) {
    const paid = `o."paymentStatus" = 'paid' and o.status <> 'cancelled'`;
    const [o] = await this.q<Record<string, string>>(
      `select count(*) placed,
              count(*) filter (where o.status = 'cancelled') cancelled,
              count(*) filter (where o.status = 'delivered') delivered,
              count(*) filter (where ${paid}) paid,
              coalesce(sum(o."payableAmount") filter (where ${paid}), 0) gross,
              coalesce(sum(o."systemCommission") filter (where ${paid}), 0) commission,
              coalesce(sum(o."sellerAmount") filter (where ${paid}), 0) seller_amount,
              count(*) filter (where ${paid} and exists (
                select 1 from order_return r where r."orderId" = o.id and r."deletedAt" is null and r.status not in ('cancelled', 'rejected'))) with_return
         from "order" o
        where o."deletedAt" is null and o."createdAt" >= $2 and o."createdAt" < $3 and ($1::int is null or o."sellerId" = $1)`,
      [sellerId, from, to],
    );
    const [r] = await this.q<Record<string, string>>(
      `select count(*) n, coalesce(sum("refundAmount"), 0) refund, coalesce(sum("commissionAmount"), 0) commission
         from order_return
        where "deletedAt" is null and status = 'returned' and "returnedAt" >= $2 and "returnedAt" < $3 and ($1::int is null or "sellerId" = $1)`,
      [sellerId, from, to],
    );
    const paidOrders = Number(o.paid);
    const gross = tidy(Number(o.gross));
    const refunds = tidy(Number(r.refund));
    const commission = tidy(Number(o.commission));
    const commissionBack = tidy(Number(r.commission));
    return {
      orders: { placed: Number(o.placed), paid: paidOrders, delivered: Number(o.delivered), cancelled: Number(o.cancelled) },
      grossSales: gross,
      refunds: { count: Number(r.n), amount: refunds },
      netSales: tidy(gross - refunds),
      averageOrder: paidOrders ? tidy(gross / paidOrders) : 0,
      commission: { earned: commission, returned: commissionBack, net: tidy(commission - commissionBack) },
      // What the seller keeps: their share of paid orders, less what the refunds cost them after commission came back.
      sellerEarnings: tidy(Number(o.seller_amount) - (refunds - commissionBack)),
      // Share of this period's sales that have a return open or finished against them.
      returnRate: paidOrders ? Math.round((Number(o.with_return) / paidOrders) * 1000) / 10 : 0,
    };
  }

  /** The period and the one before it, with the change between them. */
  async compare(sellerId: number | null, w: DashboardWindow) {
    const [now, before] = await Promise.all([this.totals(sellerId, w.from, w.to), this.totals(sellerId, w.prevFrom, w.prevTo)]);
    return {
      ...now,
      change: {
        orders: percentChange(now.orders.placed, before.orders.placed),
        paidOrders: percentChange(now.orders.paid, before.orders.paid),
        grossSales: percentChange(now.grossSales, before.grossSales),
        netSales: percentChange(now.netSales, before.netSales),
        averageOrder: percentChange(now.averageOrder, before.averageOrder),
        netCommission: percentChange(now.commission.net, before.commission.net),
        sellerEarnings: percentChange(now.sellerEarnings, before.sellerEarnings),
      },
    };
  }

  /** One point per day (or month), zero where nothing happened. */
  async series(sellerId: number | null, w: DashboardWindow) {
    const paid = `o."paymentStatus" = 'paid' and o.status <> 'cancelled'`;
    const sales = await this.q<{ k: string; placed: string; paid: string; gross: string }>(
      `select to_char(date_trunc($4, o."createdAt"), 'YYYY-MM-DD') k, count(*) placed,
              count(*) filter (where ${paid}) paid, coalesce(sum(o."payableAmount") filter (where ${paid}), 0) gross
         from "order" o
        where o."deletedAt" is null and o."createdAt" >= $2 and o."createdAt" < $3 and ($1::int is null or o."sellerId" = $1)
        group by 1`,
      [sellerId, w.from, w.to, w.bucket],
    );
    const refunds = await this.q<{ k: string; refund: string }>(
      `select to_char(date_trunc($4, "returnedAt"), 'YYYY-MM-DD') k, coalesce(sum("refundAmount"), 0) refund
         from order_return
        where "deletedAt" is null and status = 'returned' and "returnedAt" >= $2 and "returnedAt" < $3 and ($1::int is null or "sellerId" = $1)
        group by 1`,
      [sellerId, w.from, w.to, w.bucket],
    );
    const bySales = new Map(sales.map((s) => [s.k, s]));
    const byRefund = new Map(refunds.map((s) => [s.k, Number(s.refund)]));
    return bucketKeys(w).map((date) => {
      const s = bySales.get(date);
      const gross = tidy(Number(s?.gross ?? 0));
      const refund = tidy(byRefund.get(date) ?? 0);
      return { date, orders: Number(s?.placed ?? 0), paidOrders: Number(s?.paid ?? 0), grossSales: gross, refunds: refund, netSales: tidy(gross - refund) };
    });
  }

  /** Orders placed in the period, by where they are now. Every status is listed. */
  async ordersByStatus(sellerId: number | null, from: Date, to: Date) {
    const rows = await this.q<{ status: string; n: string }>(
      `select status, count(*) n from "order" o
        where o."deletedAt" is null and o."createdAt" >= $2 and o."createdAt" < $3 and ($1::int is null or o."sellerId" = $1)
        group by status`,
      [sellerId, from, to],
    );
    const by = new Map(rows.map((r) => [r.status, Number(r.n)]));
    return ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'].map((status) => ({ status, count: by.get(status) ?? 0 }));
  }

  /** Best sellers by revenue: lines of fully paid orders, not returned. */
  topProducts(sellerId: number | null, from: Date, to: Date, limit = 5) {
    return this.q<{ id: number; name: string; units: number; revenue: number }>(
      `select i."sellerProductId" id, max(i."productName") name, sum(i.quantity)::int units,
              round(coalesce(sum(coalesce(i."totalProposalPrice", i."totalDiscountedPrice", i."totalPrice")), 0)::numeric, 2)::float revenue
         from order_item i join "order" o on o.id = i."orderId"
        where o."deletedAt" is null and i."deletedAt" is null and o."paymentStatus" = 'paid' and o.status <> 'cancelled' and not i."isReturned"
          and o."createdAt" >= $2 and o."createdAt" < $3 and ($1::int is null or o."sellerId" = $1)
        group by i."sellerProductId" order by revenue desc, units desc limit $4`,
      [sellerId, from, to, limit],
    );
  }

  /** Returns waiting for the seller, and those on their way to a refund. */
  async returnsInFlight(sellerId: number | null) {
    const [r] = await this.q<Record<string, string>>(
      `select count(*) filter (where status = 'return_requested') requested,
              count(*) filter (where status in ('accepted', 'processing', 'returning_money')) in_progress
         from order_return where "deletedAt" is null and ($1::int is null or "sellerId" = $1)`,
      [sellerId],
    );
    return { requested: Number(r.requested), inProgress: Number(r.in_progress) };
  }
}
