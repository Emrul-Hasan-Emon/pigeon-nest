import {
  Body,
  Controller,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { Seller } from '../../database/entities/seller/seller.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { PostOrderUpdateDto, RecordPaymentDto, ReversePaymentDto } from '../dtos/order-staff.dtos';
import { OrderPaymentService } from '../services/order-payment.service';
import { OrderUpdateService } from '../services/order-update.service';
import { ATTACHMENTS } from './admin-order-action.controller';

// A seller's actions on their own orders. Another seller's order is "not found".
@UseGuards(AuthGuard, RolesGuard, SellerAccessGuard)
@Roles(AuthUserType.SELLER)
@RequireSellerAccess('full')
@Controller({ path: 'api/seller/orders', version: '1' })
export class SellerOrderActionController {
  constructor(
    private readonly payments: OrderPaymentService,
    private readonly updates: OrderUpdateService,
  ) {}

  private actor(seller: Seller) {
    return { id: seller.id, type: AuthUserType.SELLER, name: seller.name };
  }

  @Post(':id/payments')
  @UseInterceptors(ATTACHMENTS)
  recordPayment(
    @CurrentSeller() seller: Seller,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: RecordPaymentDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.payments.record(id, dto, files, this.actor(seller), { sellerId: seller.id });
  }

  @Post(':id/payments/:paymentId/reverse')
  reversePayment(
    @CurrentSeller() seller: Seller,
    @Param('id', ParseIdPipe) id: number,
    @Param('paymentId', ParseIdPipe) paymentId: number,
    @Body() dto: ReversePaymentDto,
  ) {
    return this.payments.reverse(id, paymentId, dto, this.actor(seller), { sellerId: seller.id });
  }

  @Post(':id/updates')
  @UseInterceptors(ATTACHMENTS)
  postUpdate(
    @CurrentSeller() seller: Seller,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: PostOrderUpdateDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.updates.post(id, dto, files, this.actor(seller), { sellerId: seller.id });
  }
}
