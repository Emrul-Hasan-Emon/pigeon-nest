import { Injectable } from '@nestjs/common';
import { Seller } from '../../database/entities/seller/seller.entity';
import { ProductReportDto, ProductReportKind, ReportGroup, ReportGroupedDto, ReportRangeDto, ReturnReportBy, ReturnReportDto } from '../dtos/report.dtos';
import { resolveReportWindow } from '../utils/report-range.util';
import { CommonReportService } from './common-report.service';

/** A seller's reports. Every query is fixed to the signed-in seller; there is no way to ask for another one. */
@Injectable()
export class SellerReportService {
  constructor(private readonly reports: CommonReportService) {}

  sales(seller: Seller, q: ReportGroupedDto) {
    return this.reports.sales(seller.id, resolveReportWindow(q), q.groupBy ?? ReportGroup.DAY);
  }

  products(seller: Seller, q: ProductReportDto) {
    return this.reports.products(seller.id, resolveReportWindow(q), q.kind ?? ProductReportKind.BEST, false);
  }

  orders(seller: Seller, q: ReportRangeDto) {
    return this.reports.orders(seller.id, resolveReportWindow(q));
  }

  earnings(seller: Seller, q: ReportGroupedDto) {
    return this.reports.earnings(seller.id, resolveReportWindow(q), q.groupBy ?? ReportGroup.DAY, true);
  }

  returnReasons(seller: Seller, q: ReturnReportDto) {
    return this.reports.returnReasons(seller.id, resolveReportWindow(q), q.by ?? ReturnReportBy.REASON);
  }
}
