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
  UseGuards,
} from '@nestjs/common';
import { CursorPagination, CursorPaginationParams } from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import {
  CreateShippingZoneDto,
  ListShippingZoneQueryDto,
  ShippingQuoteQueryDto,
  UpdateShippingZoneDto,
} from '../dtos/shipping-zone.dtos';
import { ShippingZoneService } from '../services/shipping-zone.service';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/shipping-zones', version: '1' })
export class AdminShippingZoneController {
  constructor(private readonly zones: ShippingZoneService) {}

  @Get()
  list(
    @Query() query: ListShippingZoneQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.zones.list(query, pagination);
  }

  // What would delivering to a country cost? Shows which zone, or the default, applies.
  @Get('quote')
  quote(@Query() query: ShippingQuoteQueryDto) {
    return this.zones.quote(query.country, query.deliveryType);
  }

  @Get(':id')
  details(@Param('id', ParseIdPipe) id: number) {
    return this.zones.details(id);
  }

  @Post()
  create(@Body() dto: CreateShippingZoneDto) {
    return this.zones.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIdPipe) id: number, @Body() dto: UpdateShippingZoneDto) {
    return this.zones.update(id, dto);
  }

  // Delete is switched off for now. Remove these comment marks to bring it back.
  // @Delete(':id')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // remove(@Param('id', ParseIdPipe) id: number) {
  //   return this.zones.remove(id);
  // }
}
