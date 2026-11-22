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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  CursorPagination,
  CursorPaginationParams,
} from '../../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../../shared/pipes/parse-id.pipe';
import { AdminBannerService } from '../services/admin-banner.service';
import { CreateBannerDto } from '../dtos/create-banner.dto';
import { UpdateBannerDto } from '../dtos/update-banner.dto';
import { ListBannerQueryDto } from '../dtos/list-banner-query.dto';
import { AdminAuthGuard } from '../../../auth/guards/admin-auth.guard';

// multer: 10MB per file (413 when exceeded), at most the two named files.
const BANNER_FILE_FIELDS = FileFieldsInterceptor(
  [
    { name: 'image', maxCount: 1 },
    { name: 'mobileImage', maxCount: 1 },
  ],
  { limits: { fileSize: 10 * 1024 * 1024, files: 2 } },
);

interface BannerUploadedFiles {
  image?: Express.Multer.File[];
  mobileImage?: Express.Multer.File[];
}

@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/banners', version: '1' })
export class AdminBannerController {
  constructor(private readonly adminBannerService: AdminBannerService) {}

  @Get()
  list(
    @Query() query: ListBannerQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.adminBannerService.list(query, pagination);
  }

  @Get(':id')
  details(@Param('id', ParseIdPipe) id: number) {
    return this.adminBannerService.details(id);
  }

  // Multipart: title, position, linkUrl, startsAt, endsAt, sortOrder,
  // isActive + files image (required) and mobileImage.
  @Post()
  @UseInterceptors(BANNER_FILE_FIELDS)
  create(
    @Body() dto: CreateBannerDto,
    @UploadedFiles() files?: BannerUploadedFiles,
  ) {
    return this.adminBannerService.create(dto, {
      image: files?.image?.[0],
      mobileImage: files?.mobileImage?.[0],
    });
  }

  @Patch(':id')
  @UseInterceptors(BANNER_FILE_FIELDS)
  update(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateBannerDto,
    @UploadedFiles() files?: BannerUploadedFiles,
  ) {
    return this.adminBannerService.update(id, dto, {
      image: files?.image?.[0],
      mobileImage: files?.mobileImage?.[0],
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIdPipe) id: number) {
    return this.adminBannerService.remove(id);
  }
}
