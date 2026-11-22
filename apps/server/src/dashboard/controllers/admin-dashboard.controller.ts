import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { DashboardQueryDto } from '../dtos/dashboard.dtos';
import { AdminDashboardService } from '../services/admin-dashboard.service';

// The admin dashboard: platform-wide numbers.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/dashboard', version: '1' })
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  // Only the "needs attention" counts, for the alert bell on every admin page.
  @Get('attention')
  attention() {
    return this.dashboard.attention();
  }

  @Get()
  overview(@Query() query: DashboardQueryDto) {
    return this.dashboard.overview(query);
  }
}
