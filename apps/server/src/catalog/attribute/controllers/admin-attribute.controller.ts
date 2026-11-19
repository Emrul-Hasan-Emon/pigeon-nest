import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { AuthUserType } from '../../../database/enums/auth-user-type.enum';
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../../shared/decorators/cursor-pagination-params.decorator';
import { AdminAttributeService } from '../services/admin-attribute.service';
import { CreateAttributeDto } from '../dtos/create-attribute.dto';
import { UpdateAttributeDto } from '../dtos/update-attribute.dto';
import { ListAttributeQueryDto } from '../dtos/list-attribute-query.dto';
import { CreateAttributeValueDto } from '../dtos/create-attribute-value.dto';

@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
@Controller({ path: 'api/admin/attributes', version: '1' })
export class AdminAttributeController {
  constructor(private readonly adminAttributeService: AdminAttributeService) {}

  @Get()
  list(
    @Query() query: ListAttributeQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.adminAttributeService.list(query, pagination);
  }

  @Post()
  create(@Body() dto: CreateAttributeDto) {
    return this.adminAttributeService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAttributeDto,
  ) {
    return this.adminAttributeService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminAttributeService.remove(id);
  }

  @Get(':id/values')
  listValues(@Param('id', ParseIntPipe) id: number) {
    return this.adminAttributeService.listValues(id);
  }

  @Post(':id/values')
  createValue(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAttributeValueDto,
  ) {
    return this.adminAttributeService.createValue(id, dto);
  }
}
