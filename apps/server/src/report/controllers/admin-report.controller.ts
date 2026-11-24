import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { AdminOrderReportDto, AdminProductReportDto, AdminReportGroupedDto, AdminReturnReportDto, AdminStatementQueryDto, SellerRankingDto } from '../dtos/report.dtos';
import { AdminReportService } from '../services/admin-report.service';
import { StatementService } from '../services/statement.service';

// Platform reports. Add `sellerId` to look at one seller.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/reports', version: '1' })
export class AdminReportController {
  constructor(
    private readonly reports: AdminReportService,
    private readonly statements: StatementService,
  ) {}

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

  @Get('returns')
  returns(@Query() query: AdminReturnReportDto) {
    return this.reports.returnReasons(query);
  }

  // One seller's monthly statement.
  @Get('statement')
  statement(@Query() query: AdminStatementQueryDto) {
    return this.statements.forSeller(query.sellerId, query.month);
  }

  @Get('sellers')
  sellers(@Query() query: SellerRankingDto) {
    return this.reports.sellers(query);
  }
}
