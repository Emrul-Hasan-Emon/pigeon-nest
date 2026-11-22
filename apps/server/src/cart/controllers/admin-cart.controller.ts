import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  CursorPagination,
  CursorPaginationParams,
} from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ListCartQueryDto } from '../dtos/admin-cart-query.dto';
import { AdminCartService } from '../services/admin-cart.service';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

// Admin only: sellers never see carts.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/carts', version: '1' })
export class AdminCartController {
  constructor(private readonly carts: AdminCartService) {}

  // state=active (default) or inactive; see ListCartQueryDto for every filter.
  @Get()
  list(@Query() query: ListCartQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.carts.list(query, pagination);
  }

  @Get(':id')
  details(@Param('id', ParseIdPipe) id: number) {
    return this.carts.details(id);
  }
}
