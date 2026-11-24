import { Body, Controller, Param, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUserAccount } from '../../auth/decorators/current-user-account.decorator';
import { UserAccessGuard } from '../../auth/guards/user-access.guard';
import { UserAuthGuard } from '../../auth/guards/user-auth.guard';
import { User } from '../../database/entities/person/user.entity';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { CreatePaymentClaimDto } from '../dtos/payment-claim.dtos';
import { UserPaymentClaimService } from '../services/user-payment-claim.service';

const PROOF = FilesInterceptor('files', 5, { limits: { fileSize: 10 * 1024 * 1024, files: 5 } });

// Mark as paid: a signed-in customer asks to have one of their cash-on-delivery orders marked as paid (one request per order).
@UseGuards(UserAuthGuard, UserAccessGuard)
@Controller({ path: 'api/user', version: '1' })
export class UserPaymentClaimController {
  constructor(private readonly claims: UserPaymentClaimService) {}

  // multipart: amount, transactionId, method (both required), senderNumber, paidOn, note, files (1 to 5, required)
  @Post('orders/:orderId/payment-claims')
  @UseInterceptors(PROOF)
  create(@CurrentUserAccount() user: User, @Param('orderId', ParseIdPipe) orderId: number, @Body() dto: CreatePaymentClaimDto, @UploadedFiles() files?: Express.Multer.File[]) {
    return this.claims.create(user, orderId, dto, files);
  }
}
