import { Body, Controller, Get, Param, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import { resolvePage } from '../../shared/utils/page-paginate.util';
import { AddRefundRecordDto, ChangeRefundStatusDto, ListRefundsQueryDto } from '../dtos/order-staff.dtos';
import { StaffOrderRefundService } from '../services/staff-order-refund.service';
import { ATTACHMENTS } from './admin-order-action.controller';

// The admin sees every refund, can set any status, and can add another record on an order.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin', version: '1' })
export class AdminRefundController {
  constructor(
    private readonly refunds: StaffOrderRefundService,
    private readonly actors: ActorResolverService,
  ) {}

  @Get('refunds')
  list(@Query() query: ListRefundsQueryDto) {
    return this.refunds.list(query, resolvePage(query), {});
  }

  @Get('refunds/summary')
  summary() {
    return this.refunds.summary({});
  }

  @Get('refunds/:id')
  detail(@Param('id', ParseIdPipe) id: number) {
    return this.refunds.detail(id, {});
  }

  // Any status to any other. Refunded needs the exact amount the buyer paid and a note; a proof file is optional for an admin.
  @Post('refunds/:id/status')
  @UseInterceptors(ATTACHMENTS)
  async change(@CurrentUser() jwt: JwtPayload, @Param('id', ParseIdPipe) id: number, @Body() dto: ChangeRefundStatusDto, @UploadedFiles() files?: Express.Multer.File[]) {
    return this.refunds.change(id, dto, files, await this.actors.resolve(jwt), {});
  }

  // Another money record on a return (for example "refunded" after the buyer said the seller's refund never arrived).
  @Post('returns/:returnId/money-records')
  @UseInterceptors(ATTACHMENTS)
  async addForReturn(@CurrentUser() jwt: JwtPayload, @Param('returnId', ParseIdPipe) returnId: number, @Body() dto: AddRefundRecordDto, @UploadedFiles() files?: Express.Multer.File[]) {
    return this.refunds.addForReturn(returnId, dto, files, await this.actors.resolve(jwt));
  }

  // Another record on a cancelled order (for example "refunded" after the buyer said an earlier one never arrived).
  @Post('orders/:orderId/refunds')
  @UseInterceptors(ATTACHMENTS)
  async add(@CurrentUser() jwt: JwtPayload, @Param('orderId', ParseIdPipe) orderId: number, @Body() dto: AddRefundRecordDto, @UploadedFiles() files?: Express.Multer.File[]) {
    return this.refunds.addForOrder(orderId, dto, files, await this.actors.resolve(jwt));
  }
}
