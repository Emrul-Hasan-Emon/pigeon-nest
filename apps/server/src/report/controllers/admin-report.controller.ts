import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { AdminOrderReportDto, AdminProductReportDto, AdminReportGroupedDto } from '../dtos/report.dtos';
import { AdminReportService } from '../services/admin-report.service';

// Platform reports. Add `sellerId` to look at one seller.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/reports', version: '1' })
export class AdminReportController {
  constructor(private readonly reports: AdminReportService) {}

  @Get('sales')
  sales(@Query() query: AdminReportGroupedDto) {
    return this.reports.sales(query);
  }

  @Get('products')
  products(@Query() query: AdminProductReportDto) {
    return this.reports.products(query);
  }

  @Get('orders')
  orders(@Query() query: AdminOrderReportDto) {
    return this.reports.orders(query);
  }

  @Get('earnings')
  earnings(@Query() query: AdminReportGroupedDto) {
    return this.reports.earnings(query);
  }
}
