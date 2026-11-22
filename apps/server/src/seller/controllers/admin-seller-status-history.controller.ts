import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../shared/decorators/cursor-pagination-params.decorator';
import { SellerStatusHistoryService } from '../services/seller-status-history.service';
import { ListSellerStatusHistoryQueryDto } from '../dtos/list-seller-status-history-query.dto';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

// Admin-only, read-only. Sellers never see this log.
@UseGuards(AdminAuthGuard)
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
