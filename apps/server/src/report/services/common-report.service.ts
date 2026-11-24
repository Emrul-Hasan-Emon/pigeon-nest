import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LOW_STOCK_AT } from '../../dashboard/services/seller-overview.service';
import { tidy } from '../../shared/utils/money.util';
import { RETURN_REASON_LABEL, ReturnReasonCode } from '../../database/enums/return-reason-code.enum';
import { ProductReportKind, ReportGroup, ReturnReportBy } from '../dtos/report.dtos';
import { bucketFormat, ReportWindow, windowBuckets } from '../utils/report-range.util';
import { Report } from '../utils/report.types';

const PAID = `o."paymentStatus" = 'paid' and o.status <> 'cancelled'`;
const LINE_MONEY = `coalesce(i."totalProposalPrice", i."totalDiscountedPrice", i."totalPrice")`;
const MAX_ROWS = 100;

const STATUS_WORDS: Record<string, string> = {
  pending: 'Waiting to be confirmed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/**
 * The report queries both roles share. Each takes an optional seller: a seller's report always passes their own id,
 * an admin passes one or none (the whole platform). Money and period rules match the dashboards:
 * - a sale is a fully paid, not cancelled order, counted on the day it was placed;
 * - a refund is a return that reached `returned`, counted on the day it was confirmed.
 */
@Injectable()
export class CommonReportService {
  constructor(private readonly dataSource: DataSource) {}

  private q<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<T[]> {
    return this.dataSource.query(sql, params);
  }

  /** Sales and refunds for each day or month. */
  async sales(sellerId: number | null, w: ReportWindow, group: ReportGroup): Promise<Report> {
    const fmt = bucketFormat(group);
    const [orders, refunds] = await Promise.all([
      this.q<{ k: string; placed: string; paid: string; gross: string }>(
        `select to_char(date_trunc($4, o."createdAt"), $5) k, count(*) placed, count(*) filter (where ${PAID}) paid,
                coalesce(sum(o."payableAmount") filter (where ${PAID}), 0) gross
           from "order" o
          where o."deletedAt" is null and o."createdAt" >= $2 and o."createdAt" < $3 and ($1::int is null or o."sellerId" = $1)
          group by 1`,
        [sellerId, w.from, w.to, group, fmt],
      ),
      this.q<{ k: string; refund: string }>(
        `select to_char(date_trunc($4, "returnedAt"), $5) k, coalesce(sum("refundAmount"), 0) refund
           from order_return
          where "deletedAt" is null and status = 'returned' and "returnedAt" >= $2 and "returnedAt" < $3 and ($1::int is null or "sellerId" = $1)
          group by 1`,
        [sellerId, w.from, w.to, group, fmt],
      ),
    ]);
    const byOrders = new Map(orders.map((r) => [r.k, r]));
    const byRefund = new Map(refunds.map((r) => [r.k, Number(r.refund)]));
    const all = windowBuckets(w, group).map((period) => {
      const o = byOrders.get(period);
      const sales = tidy(Number(o?.gross ?? 0));
      const refunded = tidy(byRefund.get(period) ?? 0);
      return { period, orders: Number(o?.placed ?? 0), paidOrders: Number(o?.paid ?? 0), sales, refunds: refunded, netSales: tidy(sales - refunded) };
    });
    // A long range by day would be mostly empty lines, so quiet days are left out. Months always show.
    const rows = group === ReportGroup.DAY ? all.filter((r) => r.orders || r.sales || r.refunds) : all;
    const sum = (key: 'orders' | 'paidOrders' | 'sales' | 'refunds' | 'netSales') => all.reduce((t, r) => t + r[key], 0);
    const paidOrders = sum('paidOrders');
    return {
      title: 'Sales',
      note: 'Sales are paid orders that were not cancelled, counted on the day the order was placed. Days with nothing are left out. Refunds are counted on the day the returned bird was confirmed.',
      from: w.fromDay,
      to: w.toDay,
      summary: [
        { label: 'Orders placed', value: sum('orders'), kind: 'number' },
        { label: 'Paid orders', value: paidOrders, kind: 'number' },
        { label: 'Sales', value: tidy(sum('sales')), kind: 'money' },
        { label: 'Refunds', value: tidy(sum('refunds')), kind: 'money' },
        { label: 'Sales after refunds', value: tidy(sum('netSales')), kind: 'money' },
        { label: 'Average paid order', value: paidOrders ? tidy(sum('sales') / paidOrders) : 0, kind: 'money' },
      ],
      columns: [
        { key: 'period', label: group === ReportGroup.MONTH ? 'Month' : 'Day', kind: 'text' },
        { key: 'orders', label: 'Orders placed', kind: 'number' },
        { key: 'paidOrders', label: 'Paid orders', kind: 'number' },
        { key: 'sales', label: 'Sales', kind: 'money' },
        { key: 'refunds', label: 'Refunds', kind: 'money' },
        { key: 'netSales', label: 'Sales after refunds', kind: 'money' },
      ],
      rows,
    };
  }

  /** Best sellers, slow sellers, or SKUs running low. */
  async products(sellerId: number | null, w: ReportWindow, kind: ProductReportKind, withSeller: boolean): Promise<Report> {
    const seller = withSeller ? [{ key: 'seller', label: 'Seller', kind: 'text' as const }] : [];
    const base = { from: w.fromDay, to: w.toDay };

    if (kind === ProductReportKind.LOW_STOCK) {
      const rows = await this.q<Record<string, string | number | null>>(
        `select p.id, p.name product, s.name seller, coalesce(nullif(k.sku, ''), nullif(k.description, ''), 'Option ' || k.id) option,
                k.quantity::int stock
           from seller_product_sku k
           join seller_product p on p.id = k."sellerProductId"
           join seller s on s.id = p."sellerId"
          where p."deletedAt" is null and k."deletedAt" is null and k."isActive" and p.status = 'approved' and p."activeStatus" = 'active'
            and k.quantity <= $2 and ($1::int is null or p."sellerId" = $1)
          order by k.quantity asc, p.name asc, k.id asc limit ${MAX_ROWS}`,
        [sellerId, LOW_STOCK_AT],
      );
      const out = rows.filter(Boolean);
      const empty = out.filter((r) => Number(r.stock) <= 0).length;
      return {
        title: 'Low stock',
        note: `Options that are switched on and have ${LOW_STOCK_AT} or fewer left. This is how things stand now, so the dates do not change it.`,
        ...base,
        summary: [
          { label: 'Options running low', value: out.length - empty, kind: 'number' },
          { label: 'Options sold out', value: empty, kind: 'number' },
        ],
        columns: [{ key: 'product', label: 'Product', kind: 'text' }, ...seller, { key: 'option', label: 'Option', kind: 'text' }, { key: 'stock', label: 'In stock', kind: 'number' }],
        rows: out,
      };
    }

    const stock = `(select coalesce(sum(k.quantity), 0)::int from seller_product_sku k where k."sellerProductId" = p.id and k."deletedAt" is null and k."isActive")`;
    const lines = `select i."sellerProductId" pid, sum(i.quantity)::int units, count(distinct o.id)::int orders,
                          round(coalesce(sum(${LINE_MONEY}), 0)::numeric, 2)::float revenue
                     from order_item i join "order" o on o.id = i."orderId"
                    where o."deletedAt" is null and i."deletedAt" is null and ${PAID} and not i."isReturned"
                      and o."createdAt" >= $2 and o."createdAt" < $3
                    group by i."sellerProductId"`;
    const columns = [
      { key: 'product', label: 'Product', kind: 'text' as const },
      ...seller,
      { key: 'units', label: 'Birds / items sold', kind: 'number' as const },
      { key: 'orders', label: 'Orders', kind: 'number' as const },
      { key: 'revenue', label: 'Sales', kind: 'money' as const },
      { key: 'stock', label: 'In stock now', kind: 'number' as const },
    ];

    if (kind === ProductReportKind.SLOW) {
      const rows = await this.q<Record<string, string | number | null>>(
        `select p.id, p.name product, s.name seller, coalesce(l.units, 0) units, coalesce(l.orders, 0) orders, coalesce(l.revenue, 0) revenue,
                ${stock} stock,
                coalesce((select to_char(max(o2."createdAt"), 'YYYY-MM-DD') from order_item i2 join "order" o2 on o2.id = i2."orderId"
                           where i2."sellerProductId" = p.id and i2."deletedAt" is null and o2."deletedAt" is null
                             and o2."paymentStatus" = 'paid' and o2.status <> 'cancelled'), 'Never') "lastSold"
           from seller_product p
           join seller s on s.id = p."sellerId"
           left join (${lines}) l on l.pid = p.id
          where p."deletedAt" is null and p.status = 'approved' and p."activeStatus" = 'active' and ($1::int is null or p."sellerId" = $1)
          order by coalesce(l.units, 0) asc, coalesce(l.revenue, 0) asc, p.id asc limit ${MAX_ROWS}`,
        [sellerId, w.from, w.to],
      );
      const none = rows.filter((r) => Number(r.units) === 0).length;
      return {
        title: 'Slow sellers',
        note: 'Products that are on sale now, with the ones that sold least in these dates first. A product with no sales shows 0.',
        ...base,
        summary: [
          { label: 'Products on sale (shown)', value: rows.length, kind: 'number' },
          { label: 'Sold nothing in these dates', value: none, kind: 'number' },
        ],
        columns: [...columns, { key: 'lastSold', label: 'Last sold', kind: 'text' }],
        rows,
      };
    }

    const rows = await this.q<Record<string, string | number | null>>(
      `select p.id, p.name product, s.name seller, l.units, l.orders, l.revenue, ${stock} stock
         from (${lines}) l
         join seller_product p on p.id = l.pid
         join seller s on s.id = p."sellerId"
        where ($1::int is null or p."sellerId" = $1)
        order by l.revenue desc, l.units desc, p.id asc limit ${MAX_ROWS}`,
      [sellerId, w.from, w.to],
    );
    return {
      title: 'Best sellers',
      note: 'Products that earned the most in these dates. Only paid orders that were not cancelled, and not returned birds, are counted.',
      ...base,
      summary: [
        { label: 'Products sold (shown)', value: rows.length, kind: 'number' },
        { label: 'Birds / items sold', value: rows.reduce((t, r) => t + Number(r.units), 0), kind: 'number' },
        { label: 'Sales', value: tidy(rows.reduce((t, r) => t + Number(r.revenue), 0)), kind: 'money' },
      ],
      columns,
      rows,
    };
  }

  /** How many orders are in each state, how fast they were delivered, and how many came back. */
  async orders(sellerId: number | null, w: ReportWindow): Promise<Report> {
    const [byStatus, [speed], [returns]] = await Promise.all([
      this.q<{ status: string; n: string }>(
        `select status, count(*) n from "order" o
          where o."deletedAt" is null and o."createdAt" >= $2 and o."createdAt" < $3 and ($1::int is null or o."sellerId" = $1)
          group by status`,
        [sellerId, w.from, w.to],
      ),
      this.q<{ hours: string | null; n: string }>(
        `select avg(extract(epoch from (d.at - c.at)) / 3600) hours, count(*) n
           from "order" o
           join lateral (select min(h."createdAt") at from order_status_history h where h."orderId" = o.id and h.status = 'confirmed' and h."deletedAt" is null) c on c.at is not null
           join lateral (select min(h."createdAt") at from order_status_history h where h."orderId" = o.id and h.status = 'delivered' and h."deletedAt" is null) d on d.at is not null
          where o."deletedAt" is null and o."createdAt" >= $2 and o."createdAt" < $3 and ($1::int is null or o."sellerId" = $1)`,
        [sellerId, w.from, w.to],
      ),
      this.q<{ n: string }>(
        `select count(*) n from order_return
          where "deletedAt" is null and status = 'returned' and "returnedAt" >= $2 and "returnedAt" < $3 and ($1::int is null or "sellerId" = $1)`,
        [sellerId, w.from, w.to],
      ),
    ]);
    const by = new Map(byStatus.map((r) => [r.status, Number(r.n)]));
    const total = [...by.values()].reduce((t, n) => t + n, 0);
    const rows = Object.keys(STATUS_WORDS).map((status) => {
      const count = by.get(status) ?? 0;
      return { status: STATUS_WORDS[status], orders: count, share: total ? Math.round((count / total) * 1000) / 10 : 0 };
    });
    return {
      title: 'Orders',
      note: 'Orders placed in these dates and where each one is now. Delivery time counts from the day the order was confirmed to the day it was delivered.',
      from: w.fromDay,
      to: w.toDay,
      summary: [
        { label: 'Orders placed', value: total, kind: 'number' },
        { label: 'Delivered', value: by.get('delivered') ?? 0, kind: 'number' },
        { label: 'Cancelled', value: by.get('cancelled') ?? 0, kind: 'number' },
        { label: 'Returned birds or items (orders)', value: Number(returns.n), kind: 'number' },
        { label: 'Confirm to delivered, on average', value: speed.hours === null ? null : Math.round(Number(speed.hours) * 10) / 10, kind: 'hours' },
      ],
      columns: [
        { key: 'status', label: 'Where the order is now', kind: 'text' },
        { key: 'orders', label: 'Orders', kind: 'number' },
        { key: 'share', label: 'Share of all orders', kind: 'percent' },
      ],
      rows,
    };
  }

  /** Sales, minus commission, minus refunds: what the seller keeps. */
  async earnings(sellerId: number | null, w: ReportWindow, group: ReportGroup, mine: boolean): Promise<Report> {
    const fmt = bucketFormat(group);
    const [orders, returns] = await Promise.all([
      this.q<{ k: string; gross: string; commission: string; keep: string }>(
        `select to_char(date_trunc($4, o."createdAt"), $5) k, coalesce(sum(o."payableAmount"), 0) gross,
                coalesce(sum(o."systemCommission"), 0) commission, coalesce(sum(o."sellerAmount"), 0) keep
           from "order" o
          where o."deletedAt" is null and ${PAID} and o."createdAt" >= $2 and o."createdAt" < $3 and ($1::int is null or o."sellerId" = $1)
          group by 1`,
        [sellerId, w.from, w.to, group, fmt],
      ),
      this.q<{ k: string; refund: string; back: string }>(
        `select to_char(date_trunc($4, "returnedAt"), $5) k, coalesce(sum("refundAmount"), 0) refund, coalesce(sum("commissionAmount"), 0) back
           from order_return
          where "deletedAt" is null and status = 'returned' and "returnedAt" >= $2 and "returnedAt" < $3 and ($1::int is null or "sellerId" = $1)
          group by 1`,
        [sellerId, w.from, w.to, group, fmt],
      ),
    ]);
    const byOrders = new Map(orders.map((r) => [r.k, r]));
    const byReturn = new Map(returns.map((r) => [r.k, r]));
    const all = windowBuckets(w, group).map((period) => {
      const o = byOrders.get(period);
      const r = byReturn.get(period);
      const refunds = Number(r?.refund ?? 0);
      const back = Number(r?.back ?? 0);
      return {
        period,
        sales: tidy(Number(o?.gross ?? 0)),
        commission: tidy(Number(o?.commission ?? 0)),
        refunds: tidy(refunds),
        commissionBack: tidy(back),
        keep: tidy(Number(o?.keep ?? 0) - (refunds - back)),
      };
    });
    const rows = group === ReportGroup.DAY ? all.filter((r) => r.sales || r.commission || r.refunds || r.commissionBack || r.keep) : all;
    const sum = (key: 'sales' | 'commission' | 'refunds' | 'commissionBack' | 'keep') => tidy(all.reduce((t, r) => t + r[key], 0));
    const keepLabel = mine ? 'You keep' : 'Sellers keep';
    return {
      title: mine ? 'What I earn' : 'Earnings',
      note: `${keepLabel} = sales - system commission - refunds + system commission given back on returns. System commission is the marketplace fee on each paid order.`,
      from: w.fromDay,
      to: w.toDay,
      summary: [
        { label: 'Sales', value: sum('sales'), kind: 'money' },
        { label: 'System commission', value: sum('commission'), kind: 'money' },
        { label: 'Refunds', value: sum('refunds'), kind: 'money' },
        { label: 'System commission given back', value: sum('commissionBack'), kind: 'money' },
        { label: keepLabel, value: sum('keep'), kind: 'money' },
      ],
      columns: [
        { key: 'period', label: group === ReportGroup.MONTH ? 'Month' : 'Day', kind: 'text' },
        { key: 'sales', label: 'Sales', kind: 'money' },
        { key: 'commission', label: 'System commission', kind: 'money' },
        { key: 'refunds', label: 'Refunds', kind: 'money' },
        { key: 'commissionBack', label: 'System commission given back', kind: 'money' },
        { key: 'keep', label: keepLabel, kind: 'money' },
      ],
      rows,
    };
  }

  /**
   * Why birds come back. Counts returns asked for in the dates (a return the customer cancelled is left out),
   * grouped by the reason the customer picked, by product, or (admin) by seller.
   */
  async returnReasons(sellerId: number | null, w: ReportWindow, by: ReturnReportBy): Promise<Report> {
    const base = { from: w.fromDay, to: w.toDay };
    const where = `r."deletedAt" is null and r.status <> 'cancelled' and r."createdAt" >= $2 and r."createdAt" < $3 and ($1::int is null or r."sellerId" = $1)`;
    const [tot] = await this.q<Record<string, string>>(
      `select count(*) n, coalesce(sum((select sum(ri.quantity) from order_return_item ri where ri."orderReturnId" = r.id)), 0) items,
              coalesce(sum(r."refundAmount") filter (where r.status = 'returned'), 0) refunded
         from order_return r where ${where}`,
      [sellerId, w.from, w.to],
    );
    const [paid] = await this.q<{ n: string }>(
      `select count(*) n from "order" o where o."deletedAt" is null and ${PAID} and o."createdAt" >= $2 and o."createdAt" < $3 and ($1::int is null or o."sellerId" = $1)`,
      [sellerId, w.from, w.to],
    );
    const returns = Number(tot.n);
    const paidOrders = Number(paid.n);
    const per100 = paidOrders ? Math.round((returns / paidOrders) * 1000) / 10 : 0;
    const summary = [
      { label: 'Returns asked for', value: returns, kind: 'number' as const },
      { label: 'Items in those returns', value: Number(tot.items), kind: 'number' as const },
      { label: 'Refunded so far', value: tidy(Number(tot.refunded)), kind: 'money' as const },
      { label: 'Returns for every 100 paid orders', value: per100, kind: 'number' as const },
    ];

    if (by === ReturnReportBy.PRODUCT) {
      const rows = await this.q<Record<string, string | number | null>>(
        `select p.id, p.name product, s.name seller, count(distinct r.id)::int returns, sum(ri.quantity)::int items,
                (select r2."reasonCode" from order_return r2 join order_return_item ri2 on ri2."orderReturnId" = r2.id
                   join order_item oi2 on oi2.id = ri2."orderItemId"
                  where oi2."sellerProductId" = p.id and ${where.replaceAll('r.', 'r2.')} group by r2."reasonCode" order by count(*) desc, r2."reasonCode" limit 1) "topReason",
                round(coalesce(sum(ri."refundAmount") filter (where r.status = 'returned'), 0)::numeric, 2)::float refunded
           from order_return r
           join order_return_item ri on ri."orderReturnId" = r.id
           join order_item oi on oi.id = ri."orderItemId"
           join seller_product p on p.id = oi."sellerProductId"
           join seller s on s.id = p."sellerId"
          where ${where}
          group by p.id, p.name, s.name order by returns desc, items desc, p.id limit ${MAX_ROWS}`,
        [sellerId, w.from, w.to],
      );
      const out = rows.map((r) => ({ ...r, topReason: RETURN_REASON_LABEL[r.topReason as ReturnReasonCode] ?? 'Other' }));
      return {
        title: 'Returns by product',
        note: 'Products that came back most, with the reason given most often. A return the customer cancelled is left out.',
        ...base,
        summary,
        columns: [
          { key: 'product', label: 'Product', kind: 'text' },
          ...(sellerId === null ? [{ key: 'seller', label: 'Seller', kind: 'text' as const }] : []),
          { key: 'returns', label: 'Returns', kind: 'number' },
          { key: 'items', label: 'Items', kind: 'number' },
          { key: 'topReason', label: 'Most common reason', kind: 'text' },
          { key: 'refunded', label: 'Refunded so far', kind: 'money' },
        ],
        rows: out,
      };
    }

    if (by === ReturnReportBy.SELLER) {
      const rows = await this.q<Record<string, string | number | null>>(
        `select s.id, s.name seller, count(r.id)::int returns,
                (select count(*) from "order" o where o."sellerId" = s.id and o."deletedAt" is null and ${PAID} and o."createdAt" >= $2 and o."createdAt" < $3)::int "paidOrders",
                round(coalesce(sum(r."refundAmount") filter (where r.status = 'returned'), 0)::numeric, 2)::float refunded
           from order_return r join seller s on s.id = r."sellerId"
          where ${where}
          group by s.id, s.name order by returns desc, s.id limit ${MAX_ROWS}`,
        [sellerId, w.from, w.to],
      );
      const out = rows.map((r) => ({ ...r, rate: Number(r.paidOrders) ? Math.round((Number(r.returns) / Number(r.paidOrders)) * 1000) / 10 : 0 }));
      return {
        title: 'Returns by seller',
        note: 'Sellers with the most returns in these dates, and how many returns that is for every 100 paid orders.',
        ...base,
        summary,
        columns: [
          { key: 'seller', label: 'Seller', kind: 'text' },
          { key: 'returns', label: 'Returns', kind: 'number' },
          { key: 'paidOrders', label: 'Paid orders', kind: 'number' },
          { key: 'rate', label: 'Returns per 100 paid orders', kind: 'number' },
          { key: 'refunded', label: 'Refunded so far', kind: 'money' },
        ],
        rows: out,
      };
    }

    const rows = await this.q<{ code: string; returns: number; items: number; refunded: number }>(
      `select r."reasonCode" code, count(*)::int returns,
              coalesce(sum((select sum(ri.quantity) from order_return_item ri where ri."orderReturnId" = r.id)), 0)::int items,
              round(coalesce(sum(r."refundAmount") filter (where r.status = 'returned'), 0)::numeric, 2)::float refunded
         from order_return r where ${where} group by r."reasonCode"`,
      [sellerId, w.from, w.to],
    );
    const byCode = new Map(rows.map((r) => [r.code, r]));
    const table = (Object.values(ReturnReasonCode) as ReturnReasonCode[])
      .map((code) => {
        const r = byCode.get(code);
        const n = r?.returns ?? 0;
        return { reason: RETURN_REASON_LABEL[code], returns: n, share: returns ? Math.round((n / returns) * 1000) / 10 : 0, items: r?.items ?? 0, refunded: r?.refunded ?? 0 };
      })
      .sort((a, b) => b.returns - a.returns);
    return {
      title: 'Why birds come back',
      note: 'Returns asked for in these dates, grouped by the reason the customer picked. Returns made before reasons were collected count as Other. A return the customer cancelled is left out.',
      ...base,
      summary,
      columns: [
        { key: 'reason', label: 'Reason', kind: 'text' },
        { key: 'returns', label: 'Returns', kind: 'number' },
        { key: 'share', label: 'Share of all returns', kind: 'percent' },
        { key: 'items', label: 'Items', kind: 'number' },
        { key: 'refunded', label: 'Refunded so far', kind: 'money' },
      ],
      rows: table,
    };
  }
}
