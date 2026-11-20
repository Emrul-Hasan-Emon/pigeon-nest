import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { AuthUserType } from '../../../database/enums/auth-user-type.enum';
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../../shared/decorators/cursor-pagination-params.decorator';
import { ProductStatusHistoryService } from '../services/product-status-history.service';
import { ListProductStatusHistoryQueryDto } from '../dtos/list-product-status-history-query.dto';

// Admin-only, read-only. Sellers never see this log.
@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
@Controller({ path: 'api/admin/product-status-history', version: '1' })
export class AdminProductStatusHistoryController {
  constructor(private readonly historyService: ProductStatusHistoryService) {}

  @Get()
  list(
    @Query() query: ListProductStatusHistoryQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.historyService.list(query, pagination);
  }
}
