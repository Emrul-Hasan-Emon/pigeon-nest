import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { Seller } from '../../database/entities/seller/seller.entity';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { CreatePaymentAccountDto, UpdatePaymentAccountDto } from '../dtos/payment-account.dto';
import { CommonPaymentAccountService } from '../services/common-payment-account.service';

// A seller's own bank and mobile money accounts: what buyers see on an order when they have to pay.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@Controller({ path: 'api/seller/payment-accounts', version: '1' })
export class SellerPaymentAccountController {
  constructor(private readonly accounts: CommonPaymentAccountService) {}

  @Get()
  @RequireSellerAccess('any')
  list(@CurrentSeller() seller: Seller) {
    return this.accounts.list(seller.id);
  }

  @Post()
  @RequireSellerAccess('profile')
  create(@CurrentSeller() seller: Seller, @Body() dto: CreatePaymentAccountDto) {
    return this.accounts.create(seller.id, dto, { id: seller.id, type: AuthUserType.SELLER, name: seller.name });
  }

  // Change an account, or switch it off with { isActive: false }.
  @Patch(':id')
  @RequireSellerAccess('profile')
  update(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: UpdatePaymentAccountDto) {
    return this.accounts.update(seller.id, id, dto, { id: seller.id, type: AuthUserType.SELLER, name: seller.name });
  }
}
