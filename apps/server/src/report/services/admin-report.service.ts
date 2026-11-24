import { Injectable } from '@nestjs/common';
import {
  AdminOrderReportDto,
  AdminProductReportDto,
  AdminReportGroupedDto,
  ProductReportKind,
  ReportGroup,
} from '../dtos/report.dtos';
import { resolveReportWindow } from '../utils/report-range.util';
import { CommonReportService } from './common-report.service';

/** The admin's reports: the whole platform, or one seller when `sellerId` is given. */
@Injectable()
export class AdminReportService {
  constructor(private readonly reports: CommonReportService) {}

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
}
