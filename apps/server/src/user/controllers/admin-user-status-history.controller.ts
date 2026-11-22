import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../shared/decorators/cursor-pagination-params.decorator';
import { AdminUserService } from '../services/admin-user.service';
import { ListUserStatusHistoryQueryDto } from '../dtos/list-user-status-history-query.dto';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

// Admin-only, read-only. Users never see this log.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/user-status-history', version: '1' })
export class AdminUserStatusHistoryController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  list(
    @Query() query: ListUserStatusHistoryQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.adminUserService.statusHistory(query, pagination);
  }
}
