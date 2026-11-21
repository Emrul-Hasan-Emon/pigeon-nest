import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentSeller } from '../../auth/decorators/current-seller.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequireSellerAccess } from '../../auth/decorators/require-seller-access.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { SellerAccessGuard } from '../../auth/guards/seller-access.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { Seller } from '../../database/entities/seller/seller.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { MAX_ATTACHMENTS } from '../../order/services/order-file.service';
import {
  CursorPagination,
  CursorPaginationParams,
} from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import {
  DisburseCommissionDto,
  ListBalanceQueryDto,
  ListCommissionHistoryQueryDto,
  ListDisburseQueryDto,
  ListSettingHistoryQueryDto,
  SetSellerCommissionDto,
} from '../dtos/commission.dtos';
import { CommissionDisburseService } from '../services/commission-disburse.service';
import { CommissionQueryService } from '../services/commission-query.service';
import { SellerSettingService } from '../services/seller-setting.service';

const ATTACHMENTS = FilesInterceptor('files', MAX_ATTACHMENTS, {
  limits: { fileSize: 10 * 1024 * 1024, files: MAX_ATTACHMENTS },
});

// Everything about commission, for admins: balances, ledger and payments from sellers.
@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
@Controller({ path: 'api/admin/commission', version: '1' })
export class AdminCommissionController {
  constructor(
    private readonly queries: CommissionQueryService,
    private readonly disburse: CommissionDisburseService,
    private readonly actors: ActorResolverService,
  ) {}

  @Get('balances')
  balances(@Query() query: ListBalanceQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.queries.listBalances(query, pagination);
  }

  @Get('balances/:sellerId')
  balance(@Param('sellerId', ParseIdPipe) sellerId: number) {
    return this.queries.balanceFor(sellerId);
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
    return this.disburse.record(sellerId, dto, files, await this.actors.resolve(user));
  }

  @Get('history')
  history(@Query() query: ListCommissionHistoryQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.queries.listHistory(query, pagination);
  }

  @Get('disbursements')
  disbursements(@Query() query: ListDisburseQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.queries.listDisburses(query, pagination);
  }

  @Get('disbursements/:id')
  disbursement(@Param('id', ParseIdPipe) id: number) {
    return this.queries.disburseDetails(id);
  }
}

// A seller's own commission rule, and the history of changes to every seller setting. Admin only.
@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
@Controller({ path: 'api/admin', version: '1' })
export class AdminSellerSettingController {
  constructor(
    private readonly settings: SellerSettingService,
    private readonly actors: ActorResolverService,
  ) {}

  @Get('sellers/:sellerId/commission-setting')
  async view(@Param('sellerId', ParseIdPipe) sellerId: number) {
    await this.settings.assertSellerExists(sellerId);
    return this.settings.commissionView(sellerId);
  }

  @Put('sellers/:sellerId/commission-setting')
  async set(
    @CurrentUser() user: JwtPayload,
    @Param('sellerId', ParseIdPipe) sellerId: number,
    @Body() dto: SetSellerCommissionDto,
  ) {
    await this.settings.assertSellerExists(sellerId);
    const actor = await this.actors.resolve(user);
    await this.settings.changeCommission(
      sellerId,
      { type: dto.commissionType, value: dto.commissionAmount },
      actor,
      dto.note,
    );
    return this.settings.commissionView(sellerId);
  }

  @Get('seller-settings/history')
  history(@Query() query: ListSettingHistoryQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.settings.listHistory(query, pagination);
  }
}

// What a seller may see about their own commission. Read only; even a suspended seller can look.
@UseGuards(AuthGuard, RolesGuard, SellerAccessGuard)
@Roles(AuthUserType.SELLER)
@RequireSellerAccess('any')
@Controller({ path: 'api/seller/commission', version: '1' })
export class SellerCommissionController {
  constructor(
    private readonly queries: CommissionQueryService,
    private readonly settings: SellerSettingService,
  ) {}

  @Get('balance')
  balance(@CurrentSeller() seller: Seller) {
    return this.queries.balanceFor(seller.id);
  }

  @Get('setting')
  setting(@CurrentSeller() seller: Seller) {
    return this.settings.commissionView(seller.id);
  }

  @Get('setting/history')
  settingHistory(
    @CurrentSeller() seller: Seller,
    @Query() query: ListSettingHistoryQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.settings.listHistory(query, pagination, seller.id);
  }

  @Get('history')
  history(
    @CurrentSeller() seller: Seller,
    @Query() query: ListCommissionHistoryQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.queries.listHistory(query, pagination, seller.id);
  }

  @Get('disbursements')
  disbursements(
    @CurrentSeller() seller: Seller,
    @Query() query: ListDisburseQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.queries.listDisburses(query, pagination, seller.id);
  }

  @Get('disbursements/:id')
  disbursement(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number) {
    return this.queries.disburseDetails(id, seller.id);
  }
}
