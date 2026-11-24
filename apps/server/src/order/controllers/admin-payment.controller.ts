import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ListPaymentQueryDto } from '../dtos/order-staff.dtos';
import { PaymentQueryService } from '../services/payment-query.service';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

// Every payment on every order.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/payments', version: '1' })
export class AdminPaymentController {
  constructor(private readonly payments: PaymentQueryService) {}

  @Get()
  list(@Query() query: ListPaymentQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.payments.list(query, pagination);
  }

  @Get(':id')
  details(@Param('id', ParseIdPipe) id: number) {
    return this.payments.details(id);
  }
}
