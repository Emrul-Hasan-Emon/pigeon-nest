import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../shared/decorators/cursor-pagination-params.decorator';
import { AdminUserService } from '../services/admin-user.service';
import { ListUserStatusHistoryQueryDto } from '../dtos/list-user-status-history-query.dto';

// Admin-only, read-only. Users never see this log.
@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
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
