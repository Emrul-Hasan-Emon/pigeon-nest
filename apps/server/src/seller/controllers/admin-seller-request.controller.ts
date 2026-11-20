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
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
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

@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
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
