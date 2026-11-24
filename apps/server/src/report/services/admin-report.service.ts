import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { tidy } from '../../shared/utils/money.util';
import {
  AdminOrderReportDto,
  AdminReturnReportDto,
  ReturnReportBy,
  AdminProductReportDto,
  AdminReportGroupedDto,
  ProductReportKind,
  ReportGroup,
  SellerRankingDto,
  SellerRankSort,
} from '../dtos/report.dtos';
import { resolveReportWindow } from '../utils/report-range.util';
import { CommonReportService } from './common-report.service';
import { Report } from '../utils/report.types';

/** The admin's reports: the whole platform, or one seller when `sellerId` is given. */
@Injectable()
export class AdminReportService {
  constructor(
    private readonly reports: CommonReportService,
    private readonly dataSource: DataSource,
  ) {}

  sales(q: AdminReportGroupedDto) {
    return this.reports.sales(q.sellerId ?? null, resolveReportWindow(q), q.groupBy ?? ReportGroup.DAY);
  }

  products(q: AdminProductReportDto) {
    return this.reports.products(q.sellerId ?? null, resolveReportWindow(q), q.kind ?? ProductReportKind.BEST, q.sellerId === undefined);
  }

  orders(q: AdminOrderReportDto) {
    return this.reports.orders(q.sellerId ?? null, resolveReportWindow(q));
  }

  earnings(q: AdminReportGroupedDto) {
    return this.reports.earnings(q.sellerId ?? null, resolveReportWindow(q), q.groupBy ?? ReportGroup.DAY, false);
  }

  returnReasons(q: AdminReturnReportDto) {
    return this.reports.returnReasons(q.sellerId ?? null, resolveReportWindow(q), q.by ?? ReturnReportBy.REASON);
  }

  /** Every approved seller side by side for the dates: sales, orders, returns and rating. */
  async sellers(q: SellerRankingDto): Promise<Report> {
    const w = resolveReportWindow(q);
    const sort = q.sort ?? SellerRankSort.SALES;
    const order: Record<SellerRankSort, string> = {
      [SellerRankSort.SALES]: 'sales desc, "paidOrders" desc',
      [SellerRankSort.ORDERS]: '"paidOrders" desc, sales desc',
      [SellerRankSort.RATING]: '"ratingAverage" desc nulls last, "ratingCount" desc',
      [SellerRankSort.RETURNS]: 'returns desc, "paidOrders" desc',
    };
    const rows = await this.dataSource.query(
      `select s.id, s.name seller,
              coalesce(o."paidOrders", 0)::int "paidOrders",
              round(coalesce(o.sales, 0)::numeric, 2)::float sales,
              round(coalesce(o.commission, 0)::numeric, 2)::float commission,
              coalesce(r.returns, 0)::int returns,
              case when coalesce(o."paidOrders", 0) = 0 then 0 else round((coalesce(r.returns, 0)::numeric / o."paidOrders") * 100, 1)::float end "returnRate",
              (select count(*) from seller_product p where p."sellerId" = s.id and p."deletedAt" is null and p.status = 'approved' and p."activeStatus" = 'active')::int products,
              case when coalesce(v.n, 0) = 0 then null else round(v.avg::numeric, 2)::float end "ratingAverage",
              coalesce(v.n, 0)::int "ratingCount"
         from seller s
         left join (select "sellerId", count(*) filter (where "paymentStatus" = 'paid' and status <> 'cancelled') "paidOrders",
                           sum("payableAmount") filter (where "paymentStatus" = 'paid' and status <> 'cancelled') sales,
                           sum("systemCommission") filter (where "paymentStatus" = 'paid' and status <> 'cancelled') commission
                      from "order" where "deletedAt" is null and "createdAt" >= $1 and "createdAt" < $2 group by "sellerId") o on o."sellerId" = s.id
         left join (select "sellerId", count(*) returns from order_return
                     where "deletedAt" is null and status <> 'cancelled' and "createdAt" >= $1 and "createdAt" < $2 group by "sellerId") r on r."sellerId" = s.id
         left join (select p."sellerId", count(*) n, avg(rv.rating) avg from review rv join seller_product p on p.id = rv."sellerProductId"
                     where rv.status = 'published' and rv."deletedAt" is null group by p."sellerId") v on v."sellerId" = s.id
        where s."deletedAt" is null and s.status = 'approved'
        order by ${order[sort]}, s.id limit 100`,
      [w.from, w.to],
    );
    const sum = (k: 'paidOrders' | 'sales' | 'commission' | 'returns') => rows.reduce((t: number, r: Record<string, number>) => t + Number(r[k]), 0);
    const active = rows.filter((r: Record<string, number>) => r.paidOrders > 0).length;
    return {
      title: 'Seller ranking',
      note: 'Every approved seller for these dates. Sales are paid orders that were not cancelled; returns are those asked for in the dates; rating covers all published reviews to date.',
      from: w.fromDay,
      to: w.toDay,
      summary: [
        { label: 'Sellers shown', value: rows.length, kind: 'number' },
        { label: 'Sellers with a paid order', value: active, kind: 'number' },
        { label: 'Paid orders', value: sum('paidOrders'), kind: 'number' },
        { label: 'Sales', value: tidy(sum('sales')), kind: 'money' },
        { label: 'System commission', value: tidy(sum('commission')), kind: 'money' },
        { label: 'Returns', value: sum('returns'), kind: 'number' },
      ],
      columns: [
        { key: 'seller', label: 'Seller', kind: 'text' },
        { key: 'paidOrders', label: 'Paid orders', kind: 'number' },
        { key: 'sales', label: 'Sales', kind: 'money' },
        { key: 'commission', label: 'System commission', kind: 'money' },
        { key: 'returns', label: 'Returns', kind: 'number' },
        { key: 'returnRate', label: 'Returns per 100 paid orders', kind: 'number' },
        { key: 'products', label: 'Products on sale', kind: 'number' },
        { key: 'ratingAverage', label: 'Rating (out of 5)', kind: 'number' },
        { key: 'ratingCount', label: 'Reviews', kind: 'number' },
      ],
      rows,
    };
  }
}
