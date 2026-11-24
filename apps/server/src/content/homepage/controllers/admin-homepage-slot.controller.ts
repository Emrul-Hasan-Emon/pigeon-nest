import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { HomepagePage } from '../../../database/enums/homepage-page.enum';
import {
  CursorPagination,
  CursorPaginationParams,
} from '../../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../../shared/pipes/parse-id.pipe';
import {
  HomepageDeviceQueryDto,
  HomepageSort,
  ListHomepageSectionQueryDto,
  UpdateHomepageSlotDto,
} from '../dtos/homepage-section.dtos';
import { HomepageService } from '../services/homepage.service';
import { AdminAuthGuard } from '../../../auth/guards/admin-auth.guard';

@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/homepage-slots', version: '1' })
export class AdminHomepageSlotController {
  constructor(private readonly homepage: HomepageService) {}

  @Get()
  list(
    @Query() query: ListHomepageSectionQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.homepage.list(
      HomepagePage.SLOTS,
      query,
      pagination,
      HomepageSort.DISPLAY_ORDER,
    );
  }

  @Get(':id')
  details(@Param('id', ParseIdPipe) id: number) {
    return this.homepage.details(id, HomepagePage.SLOTS);
  }

  @Get(':id/preview')
  preview(
    @Param('id', ParseIdPipe) id: number,
    @Query() query: HomepageDeviceQueryDto,
  ) {
    return this.homepage.preview(id, HomepagePage.SLOTS, query.device);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateHomepageSlotDto,
  ) {
    return this.homepage.update(id, dto, HomepagePage.SLOTS);
  }
}
