import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../../auth/guards/admin-auth.guard';
import { HomepagePage } from '../../../database/enums/homepage-page.enum';
import { CursorPagination, CursorPaginationParams } from '../../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../../shared/pipes/parse-id.pipe';
import {
  CreateHomepageSectionDto,
  HomepageDeviceQueryDto,
  HomepageSort,
  ListHomepageSectionQueryDto,
  ReorderHomepageSectionsDto,
  UpdateHomepageSectionDto,
  UpdateHomepageSlotDto,
} from '../dtos/homepage-section.dtos';
import { AdminHomepageService } from '../services/admin-homepage.service';

// The homepage, for admins: the scrolling sections of the main page (`sections`) and the fixed slots (`slots`).
@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/homepage', version: '1' })
export class AdminHomepageController {
  constructor(private readonly homepage: AdminHomepageService) {}

  // ---- sections: the main page ----

  // Metadata the admin form is generated from.
  @Get('sections/section-types')
  sectionTypes() {
    return this.homepage.sectionTypes();
  }

  @Get('sections')
  listSections(@Query() query: ListHomepageSectionQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.homepage.list(HomepagePage.MAIN, query, pagination, HomepageSort.NEWEST);
  }

  @Put('sections/reorder')
  reorderSections(@Body() dto: ReorderHomepageSectionsDto) {
    return this.homepage.reorder(dto.ids);
  }

  @Get('sections/:id')
  section(@Param('id', ParseIdPipe) id: number) {
    return this.homepage.details(id, HomepagePage.MAIN);
  }

  @Get('sections/:id/preview')
  previewSection(@Param('id', ParseIdPipe) id: number, @Query() query: HomepageDeviceQueryDto) {
    return this.homepage.preview(id, HomepagePage.MAIN, query.device);
  }

  @Post('sections')
  createSection(@Body() dto: CreateHomepageSectionDto) {
    return this.homepage.create(dto);
  }

  @Patch('sections/:id')
  updateSection(@Param('id', ParseIdPipe) id: number, @Body() dto: UpdateHomepageSectionDto) {
    return this.homepage.update(id, dto, HomepagePage.MAIN);
  }

  // Delete is switched off for now. Remove these comment marks to bring it back.
  // @Delete('sections/:id')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // removeSection(@Param('id', ParseIdPipe) id: number) {
  //   return this.homepage.remove(id);
  // }

  // ---- slots: the fixed places on the page ----

  @Get('slots')
  listSlots(@Query() query: ListHomepageSectionQueryDto, @CursorPaginationParams() pagination: CursorPagination) {
    return this.homepage.list(HomepagePage.SLOTS, query, pagination, HomepageSort.DISPLAY_ORDER);
  }

  @Get('slots/:id')
  slot(@Param('id', ParseIdPipe) id: number) {
    return this.homepage.details(id, HomepagePage.SLOTS);
  }

  @Get('slots/:id/preview')
  previewSlot(@Param('id', ParseIdPipe) id: number, @Query() query: HomepageDeviceQueryDto) {
    return this.homepage.preview(id, HomepagePage.SLOTS, query.device);
  }

  @Patch('slots/:id')
  updateSlot(@Param('id', ParseIdPipe) id: number, @Body() dto: UpdateHomepageSlotDto) {
    return this.homepage.update(id, dto, HomepagePage.SLOTS);
  }
}
