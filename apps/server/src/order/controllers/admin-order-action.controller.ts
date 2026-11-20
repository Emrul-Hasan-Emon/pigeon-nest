import {
  Body,
  Controller,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import { PostOrderUpdateDto, RecordPaymentDto, ReversePaymentDto } from '../dtos/order-staff.dtos';
import { MAX_ATTACHMENTS } from '../services/order-file.service';
import { OrderPaymentService } from '../services/order-payment.service';
import { OrderUpdateService } from '../services/order-update.service';

export const ATTACHMENTS = FilesInterceptor('files', MAX_ATTACHMENTS, {
  limits: { fileSize: 10 * 1024 * 1024, files: MAX_ATTACHMENTS },
});

// Admin actions on any order. (Order lists, details and status changes are in AdminOrderController.)
@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
@Controller({ path: 'api/admin/orders', version: '1' })
export class AdminOrderActionController {
  constructor(
    private readonly payments: OrderPaymentService,
    private readonly updates: OrderUpdateService,
    private readonly actors: ActorResolverService,
  ) {}

  // Mark an order paid (fully or in part). multipart: description, files (1-10), amount?, transactionId?, paidAt?
  @Post(':id/payments')
  @UseInterceptors(ATTACHMENTS)
  async recordPayment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: RecordPaymentDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.payments.record(id, dto, files, await this.actors.resolve(user));
  }

  // Undo a recorded payment. Needs a reason; the order's payment status and history follow.
  @Post(':id/payments/:paymentId/reverse')
  async reversePayment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIdPipe) id: number,
    @Param('paymentId', ParseIdPipe) paymentId: number,
    @Body() dto: ReversePaymentDto,
  ) {
    return this.payments.reverse(id, paymentId, dto, await this.actors.resolve(user));
  }

  // Tell everyone on the order something: text, files, or both.
  @Post(':id/updates')
  @UseInterceptors(ATTACHMENTS)
  async postUpdate(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: PostOrderUpdateDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.updates.post(id, dto, files, await this.actors.resolve(user));
  }
}
