import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import {
  CursorPagination,
  CursorPaginationParams,
} from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { gatewayTypeRules } from '../utils/payment-gateway.util';
import {
  CreatePaymentGatewayDto,
  ListPaymentGatewayQueryDto,
  UpdatePaymentGatewayDto,
} from '../dtos/payment-gateway.dtos';
import { AdminPaymentGatewayService } from '../services/admin-payment-gateway.service';

const ICON = FileInterceptor('icon', { limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
@Controller({ path: 'api/admin/payment-gateways', version: '1' })
export class AdminPaymentGatewayController {
  constructor(private readonly service: AdminPaymentGatewayService) {}

  @Get()
  list(
    @Query() query: ListPaymentGatewayQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.service.list(query, pagination);
  }

  // Per-type rules (which account fields, whether instructions are needed, what the customer submits).
  @Get('types')
  types() {
    return gatewayTypeRules();
  }

  @Get(':id')
  details(@Param('id', ParseIdPipe) id: number) {
    return this.service.details(id);
  }

  @Post()
  @UseInterceptors(ICON)
  create(@Body() dto: CreatePaymentGatewayDto, @UploadedFile() icon?: Express.Multer.File) {
    return this.service.create(dto, icon);
  }

  @Patch(':id')
  @UseInterceptors(ICON)
  update(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdatePaymentGatewayDto,
    @UploadedFile() icon?: Express.Multer.File,
  ) {
    return this.service.update(id, dto, icon);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIdPipe) id: number) {
    return this.service.remove(id);
  }
}
