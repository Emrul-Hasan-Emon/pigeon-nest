import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { resolvePage } from '../../shared/utils/page-paginate.util';
import { ConfirmPaymentClaimDto, ListPaymentClaimsQueryDto, RejectPaymentClaimDto } from '../dtos/payment-claim.dtos';
import { StaffPaymentClaimService } from '../services/staff-payment-claim.service';

// A seller checks the "I have paid" messages on their own orders. Reading works in every state; deciding needs a working account.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@Controller({ path: 'api/seller/payment-claims', version: '1' })
export class SellerPaymentClaimController {
  constructor(private readonly claims: StaffPaymentClaimService) {}

  private actor(seller: Seller) {
    return { id: seller.id, type: AuthUserType.SELLER, name: seller.name };
  }

  @Get()
  @RequireSellerAccess('any')
  list(@CurrentSeller() seller: Seller, @Query() query: ListPaymentClaimsQueryDto) {
    return this.claims.list(query, resolvePage(query), { sellerId: seller.id });
  }

  @Get('summary')
  @RequireSellerAccess('any')
  async summary(@CurrentSeller() seller: Seller) {
    return { pending: await this.claims.pendingCount({ sellerId: seller.id }) };
  }

  // The money is recorded on the order as a normal payment.
  @Post(':id/confirm')
  @RequireSellerAccess('full')
  confirm(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: ConfirmPaymentClaimDto) {
    return this.claims.confirm(id, dto, this.actor(seller), { sellerId: seller.id });
  }

  @Post(':id/reject')
  @RequireSellerAccess('full')
  reject(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: RejectPaymentClaimDto) {
    return this.claims.reject(id, dto.reason, this.actor(seller), { sellerId: seller.id });
  }
}
