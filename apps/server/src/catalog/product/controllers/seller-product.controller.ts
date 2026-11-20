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
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { SellerAccessGuard } from '../../../auth/guards/seller-access.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { RequireSellerAccess } from '../../../auth/decorators/require-seller-access.decorator';
import { CurrentSeller } from '../../../auth/decorators/current-seller.decorator';
import { AuthUserType } from '../../../database/enums/auth-user-type.enum';
import { Seller } from '../../../database/entities/seller/seller.entity';
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../../shared/pipes/parse-id.pipe';
import { SellerProductService } from '../services/seller-product.service';
import { CreateSellerProductDto } from '../dtos/create-seller-product.dto';
import { UpdateSellerProductDto } from '../dtos/update-seller-product.dto';
import { ListSellerProductQueryDto } from '../dtos/list-seller-product-query.dto';
import { UpdateProductMediaFilesDto } from '../dtos/update-product-media-files.dto';

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

// A seller's own products. Needs an approved + active seller; a seller can
// only ever see and change their own products, and rejected or suspended
// products are frozen.
@UseGuards(AuthGuard, RolesGuard, SellerAccessGuard)
@Roles(AuthUserType.SELLER)
@RequireSellerAccess('full')
@Controller({ path: 'api/seller/products', version: '1' })
export class SellerProductController {
  constructor(private readonly sellerProductService: SellerProductService) {}

  @Get()
  list(
    @CurrentSeller() seller: Seller,
    @Query() query: ListSellerProductQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.sellerProductService.list(seller, query, pagination);
  }

  @Get(':id')
  details(
    @CurrentSeller() seller: Seller,
    @Param('id', ParseIdPipe) id: number,
  ) {
    return this.sellerProductService.details(seller, id);
  }

  @Post()
  create(@CurrentSeller() seller: Seller, @Body() dto: CreateSellerProductDto) {
    return this.sellerProductService.create(seller, dto);
  }

  @Patch(':id')
  update(
    @CurrentSeller() seller: Seller,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateSellerProductDto,
  ) {
    return this.sellerProductService.update(seller, id, dto);
  }

  // Multipart: thumbnailImage, removeThumbnail, mediaFiles[], removeMediaFilesIds.
  @Patch(':id/media-files')
  @UseInterceptors(MEDIA_FILE_FIELDS)
  updateMediaFiles(
    @CurrentSeller() seller: Seller,
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateProductMediaFilesDto,
    @UploadedFiles() files?: ProductUploadedFiles,
  ) {
    return this.sellerProductService.updateMediaFiles(seller, id, dto, {
      thumbnailImage: files?.thumbnailImage?.[0],
      mediaFiles: files?.mediaFiles,
    });
  }

  @Delete(':id')
  remove(
    @CurrentSeller() seller: Seller,
    @Param('id', ParseIdPipe) id: number,
  ) {
    return this.sellerProductService.remove(seller, id);
  }
}
