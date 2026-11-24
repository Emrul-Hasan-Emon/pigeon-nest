import { Module } from '@nestjs/common';
import { AdminReportController } from './controllers/admin-report.controller';
import { SellerReportController } from './controllers/seller-report.controller';
import { AdminReportService } from './services/admin-report.service';
import { CommonReportService } from './services/common-report.service';
import { StatementService } from './services/statement.service';
import { SellerReportService } from './services/seller-report.service';

@Module({
  controllers: [AdminReportController, SellerReportController],
  providers: [CommonReportService, AdminReportService, SellerReportService, StatementService],
})
export class ReportModule {}
