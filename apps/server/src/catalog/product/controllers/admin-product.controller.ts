import {
  Body,
  Controller,
  Delete,
  Get,
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
  CursorPaginationParams,
  CursorPagination,
} from '../../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../../shared/pipes/parse-id.pipe';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';
import { ProductStatusHistoryService } from '../services/product-status-history.service';
import { AdminProductService } from '../services/admin-product.service';
import { CreateProductDto } from '../dtos/create-product.dto';
import { UpdateProductDto } from '../dtos/update-product.dto';
import { ListProductQueryDto } from '../dtos/list-product-query.dto';
import { UpdateProductMediaFilesDto } from '../dtos/update-product-media-files.dto';
import { AdminAuthGuard } from '../../../auth/guards/admin-auth.guard';

// Per-file cap enforced by multer (413 when exceeded); at most 21 files.
const MEDIA_FILE_FIELDS = FileFieldsInterceptor(
  [
    { name: 'thumbnailImage', maxCount: 1 },
    { name: 'mediaFiles', maxCount: 20 },
  ],
  { limits: { fileSize: 50 * 1024 * 1024, files: 21 } },
);

interface ProductUploadedFiles {
  thumbnailImage?: Express.Multer.File[];
  mediaFiles?: Express.Multer.File[];
}

@UseGuards(AdminAuthGuard)
@Controller({ path: 'api/admin/products', version: '1' })
export class AdminProductController {
  constructor(
    private readonly adminProductService: AdminProductService,
    private readonly historyService: ProductStatusHistoryService,
  ) {}

  @Get()
  list(
    @Query() query: ListProductQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.adminProductService.list(query, pagination);
  }

  @Get(':id')
  details(@Param('id', ParseIdPipe) id: number) {
    return this.adminProductService.details(id);
  }

  // JSON body; creates the product together with its SKUs.
  @Post()
  async create(@Body() dto: CreateProductDto, @CurrentUser() user: JwtPayload) {
    return this.adminProductService.create(
      dto,
      await this.historyService.adminActor(user),
    );
  }

  // JSON body; updates product fields and updates/creates/removes SKUs.
  @Patch(':id')
  async update(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminProductService.update(
      id,
      dto,
      await this.historyService.adminActor(user),
    );
  }

  // Multipart: thumbnailImage, removeThumbnail, mediaFiles[], removeMediaFilesIds.
  @Patch(':id/media-files')
  @UseInterceptors(MEDIA_FILE_FIELDS)
  updateMediaFiles(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateProductMediaFilesDto,
    @UploadedFiles() files?: ProductUploadedFiles,
  ) {
    return this.adminProductService.updateMediaFiles(id, dto, {
      thumbnailImage: files?.thumbnailImage?.[0],
      mediaFiles: files?.mediaFiles,
    });
  }

  @Delete(':id')
  remove(@Param('id', ParseIdPipe) id: number) {
    return this.adminProductService.remove(id);
  }
}
