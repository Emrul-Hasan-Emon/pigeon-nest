import { Body, Controller, Get, Param, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { SellerAuthGuard } from '../../auth/guards/seller-auth.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { resolvePage } from '../../shared/utils/page-paginate.util';
import { ChangeRefundStatusDto, ListRefundsQueryDto } from '../dtos/order-staff.dtos';
import { StaffOrderRefundService } from '../services/staff-order-refund.service';
import { ATTACHMENTS } from './admin-order-action.controller';

// The seller's refunds: cancelled orders of theirs that had money paid, and the steps to send it back.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@Controller({ path: 'api/seller/refunds', version: '1' })
export class SellerRefundController {
  constructor(private readonly refunds: StaffOrderRefundService) {}

  private actor(seller: Seller) {
    return { id: seller.id, type: AuthUserType.SELLER, name: seller.name };
  }

  @Get()
  @RequireSellerAccess('any')
  list(@CurrentSeller() seller: Seller, @Query() query: ListRefundsQueryDto) {
    return this.refunds.list(query, resolvePage(query), { sellerId: seller.id });
  }

  @Get('summary')
  @RequireSellerAccess('any')
  summary(@CurrentSeller() seller: Seller) {
    return this.refunds.summary({ sellerId: seller.id });
  }

  @Get(':id')
  @RequireSellerAccess('any')
  detail(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number) {
    return this.refunds.detail(id, { sellerId: seller.id });
  }

  // multipart: status, amount, note, transactionId, files. needs_to_refund -> processing -> refunded.
  // Refunded needs the amount (exactly what the buyer paid), a note and at least one proof file.
  @Post(':id/status')
  @RequireSellerAccess('full')
  @UseInterceptors(ATTACHMENTS)
  change(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number, @Body() dto: ChangeRefundStatusDto, @UploadedFiles() files?: Express.Multer.File[]) {
    return this.refunds.change(id, dto, files, this.actor(seller), { sellerId: seller.id });
  }
}
