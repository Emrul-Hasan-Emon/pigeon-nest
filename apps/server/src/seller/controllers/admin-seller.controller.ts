import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import { resolvePage } from '../../shared/utils/page-paginate.util';
import { CreatePaymentAccountDto, UpdatePaymentAccountDto } from '../dtos/payment-account.dto';
import { CreateSellerDto } from '../dtos/create-seller.dto';
import { ListSellerQueryDto } from '../dtos/list-seller-query.dto';
import { ListSellerRequestQueryDto } from '../dtos/list-seller-request-query.dto';
import { ListSellerStatusHistoryQueryDto } from '../dtos/list-seller-status-history-query.dto';
import { RejectSellerDto } from '../dtos/reject-seller.dto';
import { SellerOnboardingQueryDto } from '../dtos/seller-onboarding-query.dto';
import { UpdateSellerDto } from '../dtos/update-seller.dto';
import { AdminSellerService } from '../services/admin-seller.service';
import { CommonSellerService } from '../services/common-seller.service';

const SELLER_FILE_FIELDS = FileFieldsInterceptor([
  { name: 'avatar', maxCount: 1 },
  { name: 'nidFrontImage', maxCount: 1 },
  { name: 'nidBackImage', maxCount: 1 },
]);

interface SellerFiles {
  avatar?: Express.Multer.File[];
  nidFrontImage?: Express.Multer.File[];
  nidBackImage?: Express.Multer.File[];
}

// Everything an admin does with sellers: the sellers, sign-up requests, status history, shop set-up progress and payment accounts.
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/seller', version: '1' })
export class AdminSellerController {
  constructor(
    private readonly adminSellerService: AdminSellerService,
    private readonly common: CommonSellerService,
    private readonly actors: ActorResolverService,
  ) {}

  @Get()
  list(
    @Query() query: ListSellerQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.adminSellerService.list(query, pagination);
  }

  @Post()
  @UseInterceptors(SELLER_FILE_FIELDS)
  create(
    @Body() dto: CreateSellerDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFiles() files?: SellerFiles,
  ) {
    return this.adminSellerService.create(
      dto,
      {
        avatar: files?.avatar?.[0],
        nidFrontImage: files?.nidFrontImage?.[0],
        nidBackImage: files?.nidBackImage?.[0],
      },
      user,
    );
  }

  // ---- sign-up requests

  @Get('requests')
  listRequests(
    @Query() query: ListSellerRequestQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.adminSellerService.listRequests(query, pagination);
  }

  @Post('requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  approveRequest(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminSellerService.approveRequest(id, user);
  }

  @Post('requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  rejectRequest(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: RejectSellerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminSellerService.rejectRequest(id, dto.reason, user);
  }

  // ---- status history (read-only; sellers never see this log)

  @Get('status-history')
  listStatusHistory(
    @Query() query: ListSellerStatusHistoryQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.adminSellerService.listStatusHistory(query, pagination);
  }

  // ---- how far every seller has got with setting up their shop

  @Get('onboarding')
  listOnboarding(@Query() query: SellerOnboardingQueryDto) {
    return this.adminSellerService.listOnboarding(query.search, query.show, resolvePage(query));
  }

  @Get('onboarding/:sellerId')
  onboardingOf(@Param('sellerId', ParseIdPipe) sellerId: number) {
    return this.common.onboardingFor(sellerId);
  }

  // ---- one seller

  @Get(':id')
  details(@Param('id', ParseIntPipe) id: number) {
    return this.adminSellerService.details(id);
  }

  @Patch(':id')
  @UseInterceptors(SELLER_FILE_FIELDS)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSellerDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFiles() files?: SellerFiles,
  ) {
    return this.adminSellerService.update(
      id,
      dto,
      {
        avatar: files?.avatar?.[0],
        nidFrontImage: files?.nidFrontImage?.[0],
        nidBackImage: files?.nidBackImage?.[0],
      },
      user,
    );
  }

  // The admin sees and can fix any seller's payment accounts (for example when helping a new seller).
  @Get(':sellerId/payment-accounts')
  listAccounts(@Param('sellerId', ParseIdPipe) sellerId: number) {
    return this.common.listAccounts(sellerId);
  }

  @Post(':sellerId/payment-accounts')
  async createAccount(@CurrentUser() jwt: JwtPayload, @Param('sellerId', ParseIdPipe) sellerId: number, @Body() dto: CreatePaymentAccountDto) {
    return this.common.createAccount(sellerId, dto, await this.actors.resolve(jwt));
  }

  @Patch(':sellerId/payment-accounts/:id')
  async updateAccount(@CurrentUser() jwt: JwtPayload, @Param('sellerId', ParseIdPipe) sellerId: number, @Param('id', ParseIdPipe) id: number, @Body() dto: UpdatePaymentAccountDto) {
    return this.common.updateAccount(sellerId, id, dto, await this.actors.resolve(jwt));
  }
}
