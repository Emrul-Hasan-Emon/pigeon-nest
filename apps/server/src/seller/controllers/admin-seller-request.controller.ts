import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { AdminSellerRequestService } from '../services/admin-seller-request.service';
import { ListSellerRequestQueryDto } from '../dtos/list-seller-request-query.dto';
import { RejectSellerDto } from '../dtos/reject-seller.dto';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/seller-requests', version: '1' })
export class AdminSellerRequestController {
  constructor(
    private readonly adminSellerRequestService: AdminSellerRequestService,
  ) {}

  @Get()
  list(
    @Query() query: ListSellerRequestQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.adminSellerRequestService.list(query, pagination);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('id', ParseIdPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminSellerRequestService.approve(id, user);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: RejectSellerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminSellerRequestService.reject(id, dto.reason, user);
  }
}
