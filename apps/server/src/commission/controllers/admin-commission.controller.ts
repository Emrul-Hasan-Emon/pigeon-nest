import { Body, Controller, Get, Param, Post, Put, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { MAX_ATTACHMENTS } from '../../order/services/order-file.service';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import {
  DisburseCommissionDto,
  ListBalanceQueryDto,
  ListCommissionChangesQueryDto,
  ListCommissionHistoryQueryDto,
  ListDisburseQueryDto,
  ListSettingHistoryQueryDto,
  SetSellerCommissionDto,
} from '../dtos/commission.dtos';
import { AdminCommissionService } from '../services/admin-commission.service';

const ATTACHMENTS = FilesInterceptor('files', MAX_ATTACHMENTS, {
  limits: { fileSize: 10 * 1024 * 1024, files: MAX_ATTACHMENTS },
});

// Everything about commission, for admins: balances, ledger, payments from sellers, and each seller's own rate.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/commission', version: '1' })
export class AdminCommissionController {
  constructor(
    private readonly commission: AdminCommissionService,
    private readonly actors: ActorResolverService,
  ) {}

  @Get('balances')
  balances(@Query() query: ListBalanceQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.commission.listBalances(query, pagination);
  }

  @Get('balances/:sellerId')
  balance(@Param('sellerId', ParseIdPipe) sellerId: number) {
    return this.commission.balance(sellerId);
  }

  // Record money received from a seller. multipart: amount, notes?, files? (optional)
  @Post('balances/:sellerId/disbursements')
  @UseInterceptors(ATTACHMENTS)
  async record(
    @CurrentUser() user: JwtPayload,
    @Param('sellerId', ParseIdPipe) sellerId: number,
    @Body() dto: DisburseCommissionDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.commission.record(sellerId, dto, files, await this.actors.resolve(user));
  }

  @Get('history')
  history(@Query() query: ListCommissionHistoryQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.commission.listHistory(query, pagination);
  }

  // Every move of every seller's balance (before and after).
  @Get('changes')
  changes(@Query() query: ListCommissionChangesQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.commission.listChanges(query, pagination);
  }

  @Get('disbursements')
  disbursements(@Query() query: ListDisburseQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.commission.listDisbursements(query, pagination);
  }

  @Get('disbursements/:id')
  disbursement(@Param('id', ParseIdPipe) id: number) {
    return this.commission.disbursement(id);
  }

  // A seller's own commission rule. A seller without one pays the global rate.
  @Get('sellers/:sellerId/setting')
  setting(@Param('sellerId', ParseIdPipe) sellerId: number) {
    return this.commission.setting(sellerId);
  }

  @Put('sellers/:sellerId/setting')
  async setRule(@CurrentUser() user: JwtPayload, @Param('sellerId', ParseIdPipe) sellerId: number, @Body() dto: SetSellerCommissionDto) {
    return this.commission.setRule(sellerId, dto, await this.actors.resolve(user));
  }

  // Every change to every seller's own rate.
  @Get('settings/history')
  settingHistory(@Query() query: ListSettingHistoryQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.commission.settingHistory(query, pagination);
  }
}
