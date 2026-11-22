import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import {
  CursorPagination,
  CursorPaginationParams,
} from '../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { ActorResolverService } from '../../shared/services/actor-resolver.service';
import { UpdateSettingsDto } from '../dtos/settings.dtos';
import {
  CreateShippingZoneDto,
  ListShippingZoneQueryDto,
  ShippingQuoteQueryDto,
  UpdateShippingZoneDto,
} from '../dtos/shipping-zone.dtos';
import { ShippingZoneService } from '../services/shipping-zone.service';
import { SystemSettingsService } from '../services/system-settings.service';
import { listCountries } from '../utils/countries';
import { AdminAuthGuard } from '../../auth/guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/settings', version: '1' })
export class AdminSettingsController {
  constructor(
    private readonly settings: SystemSettingsService,
    private readonly actors: ActorResolverService,
  ) {}

  @Get()
  list() {
    return this.settings.list();
  }

  @Patch()
  async update(@Body() dto: UpdateSettingsDto, @CurrentUser() user: JwtPayload) {
    return this.settings.update(dto.settings, await this.actors.resolve(user));
  }
}

@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/countries', version: '1' })
export class AdminCountryController {
  @Get()
  list() {
    return listCountries();
  }
}

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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIdPipe) id: number) {
    return this.zones.remove(id);
  }
}
