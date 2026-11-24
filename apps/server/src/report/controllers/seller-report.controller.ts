import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { ProductReportDto, ReportGroupedDto, ReportRangeDto, ReturnReportDto, StatementQueryDto } from '../dtos/report.dtos';
import { SellerReportService } from '../services/seller-report.service';
import { StatementService } from '../services/statement.service';

// A seller reads reports about their own shop. Reading works for a suspended seller too: it is their own record.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@RequireSellerAccess('any')
@Controller({ path: 'api/seller/reports', version: '1' })
export class SellerReportController {
  constructor(
    private readonly reports: SellerReportService,
    private readonly statements: StatementService,
  ) {}

  @Get('sales')
  sales(@CurrentSeller() seller: Seller, @Query() query: ReportGroupedDto) {
    return this.reports.sales(seller, query);
  }

  @Get('products')
  products(@CurrentSeller() seller: Seller, @Query() query: ProductReportDto) {
    return this.reports.products(seller, query);
  }

  @Get('orders')
  orders(@CurrentSeller() seller: Seller, @Query() query: ReportRangeDto) {
    return this.reports.orders(seller, query);
  }

  @Get('earnings')
  earnings(@CurrentSeller() seller: Seller, @Query() query: ReportGroupedDto) {
    return this.reports.earnings(seller, query);
  }

  // The monthly statement: sales, system commission, refunds, payments made, and what is owed.
  @Get('statement')
  statement(@CurrentSeller() seller: Seller, @Query() query: StatementQueryDto) {
    return this.statements.forSeller(seller.id, query.month);
  }

  @Get('returns')
  returns(@CurrentSeller() seller: Seller, @Query() query: ReturnReportDto) {
    return this.reports.returnReasons(seller, query);
  }
}
