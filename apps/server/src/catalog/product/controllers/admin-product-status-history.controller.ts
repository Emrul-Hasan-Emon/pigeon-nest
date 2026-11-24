import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../../shared/decorators/cursor-pagination-params.decorator';
import { ProductStatusHistoryService } from '../services/product-status-history.service';
import { ListProductStatusHistoryQueryDto } from '../dtos/list-product-status-history-query.dto';
import { AdminAuthGuard } from '../../../auth/guards/admin-auth.guard';

// Admin-only, read-only. A seller reads only their own products' log, at api/seller/products/:id/status-history.
@UseGuards(AdminAuthGuard)
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
