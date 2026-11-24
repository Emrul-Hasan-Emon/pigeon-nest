import { Module } from '@nestjs/common';
import { AdminReportController } from './controllers/admin-report.controller';
import { SellerReportController } from './controllers/seller-report.controller';
import { AdminReportService } from './services/admin-report.service';
import { CommonReportService } from './services/common-report.service';
import { SellerReportService } from './services/seller-report.service';

@Module({
  controllers: [AdminReportController, SellerReportController],
  providers: [CommonReportService, AdminReportService, SellerReportService],
})
export class ReportModule {}
