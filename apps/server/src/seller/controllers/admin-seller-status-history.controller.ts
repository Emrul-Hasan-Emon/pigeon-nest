import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../shared/decorators/cursor-pagination-params.decorator';
import { SellerStatusHistoryService } from '../services/seller-status-history.service';
import { ListSellerStatusHistoryQueryDto } from '../dtos/list-seller-status-history-query.dto';

// Admin-only, read-only. Sellers never see this log.
@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
@Controller({ path: 'api/admin/seller-status-history', version: '1' })
export class AdminSellerStatusHistoryController {
  constructor(
    private readonly sellerStatusHistoryService: SellerStatusHistoryService,
  ) {}

  @Get()
  list(
    @Query() query: ListSellerStatusHistoryQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.sellerStatusHistoryService.list(query, pagination);
  }
}
