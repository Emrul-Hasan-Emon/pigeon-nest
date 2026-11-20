import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import {
  CursorPagination,
  CursorPaginationParams,
} from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ListPaymentQueryDto } from '../dtos/order-staff.dtos';
import { PaymentQueryService } from '../services/payment-query.service';

// Every payment on every order.
@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
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

// Payments on the seller's own orders only.
@UseGuards(AuthGuard, RolesGuard, SellerAccessGuard)
@Roles(AuthUserType.SELLER)
@RequireSellerAccess('full')
@Controller({ path: 'api/seller/payments', version: '1' })
export class SellerPaymentController {
  constructor(private readonly payments: PaymentQueryService) {}

  @Get()
  list(
    @CurrentSeller() seller: Seller,
    @Query() query: ListPaymentQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.payments.list({ ...query, sellerId: undefined }, pagination, seller.id);
  }

  @Get(':id')
  details(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number) {
    return this.payments.details(id, seller.id);
  }
}
