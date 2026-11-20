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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { AuthUserType } from '../../../database/enums/auth-user-type.enum';
import { HomepagePage } from '../../../database/enums/homepage-page.enum';
import {
  CursorPagination,
  CursorPaginationParams,
} from '../../../shared/decorators/cursor-pagination-params.decorator';
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
import { HomepageService } from '../services/homepage.service';

@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
@Controller({ path: 'api/admin/homepage-sections', version: '1' })
export class AdminHomepageSectionController {
  constructor(private readonly homepage: HomepageService) {}

  // Metadata the admin form is generated from.
  @Get('section-types')
  sectionTypes() {
    return this.homepage.sectionTypes();
  }

  @Get()
  list(
    @Query() query: ListHomepageSectionQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.homepage.list(
      HomepagePage.MAIN,
      query,
      pagination,
      HomepageSort.NEWEST,
    );
  }

  @Put('reorder')
  reorder(@Body() dto: ReorderHomepageSectionsDto) {
    return this.homepage.reorder(dto.ids);
  }

  @Get(':id')
  details(@Param('id', ParseIdPipe) id: number) {
    return this.homepage.details(id, HomepagePage.MAIN);
  }

  @Get(':id/preview')
  preview(
    @Param('id', ParseIdPipe) id: number,
    @Query() query: HomepageDeviceQueryDto,
  ) {
    return this.homepage.preview(id, HomepagePage.MAIN, query.device);
  }

  @Post()
  create(@Body() dto: CreateHomepageSectionDto) {
    return this.homepage.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateHomepageSectionDto,
  ) {
    return this.homepage.update(id, dto, HomepagePage.MAIN);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIdPipe) id: number) {
    return this.homepage.remove(id);
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles(AuthUserType.ADMIN)
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
