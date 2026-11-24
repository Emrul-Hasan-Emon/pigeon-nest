import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile } from '@nestjs/common';
import { SaveSkuParentDto } from '../dtos/save-sku-parent.dto';
import { ParentRole } from '../../../database/entities/product/seller-product-sku-parent.entity';
import { BadRequestException, ParseEnumPipe } from '@nestjs/common';
import { SellerAccessGuard } from '../../../auth/guards/seller-access.guard';
import { RequireSellerAccess } from '../../../auth/decorators/require-seller-access.decorator';
import { CurrentSeller } from '../../../auth/decorators/current-seller.decorator';
import { Seller } from '../../../database/entities/seller/seller.entity';
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../../shared/decorators/cursor-pagination-params.decorator';
import { ParseIdPipe } from '../../../shared/pipes/parse-id.pipe';
import { ProductStatusHistoryService } from '../services/product-status-history.service';
import { SellerProductService } from '../services/seller-product.service';
import { CreateSellerProductDto } from '../dtos/create-seller-product.dto';
import { UpdateSellerProductDto } from '../dtos/update-seller-product.dto';
import { ListSellerProductQueryDto } from '../dtos/list-seller-product-query.dto';
import { UpdateProductMediaFilesDto } from '../dtos/update-product-media-files.dto';
import { SellerAuthGuard } from '../../../auth/guards/seller-auth.guard';
import { BulkProductDto } from '../dtos/bulk-product.dto';

const MEDIA_FILE_FIELDS = FileFieldsInterceptor(
  [
    { name: 'thumbnailImage', maxCount: 1 },
    { name: 'mediaFiles', maxCount: 20 },
  ],
  { limits: { fileSize: 50 * 1024 * 1024, files: 21 } },
);

const PARENT_IMAGE = FileInterceptor('image', { limits: { fileSize: 10 * 1024 * 1024 } });

interface ProductUploadedFiles {
  thumbnailImage?: Express.Multer.File[];
  mediaFiles?: Express.Multer.File[];
}

// A seller's own products. Needs an approved + active seller; a seller can
// only ever see and change their own products, and rejected or suspended
// products are frozen.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@RequireSellerAccess('full')
@Controller({ path: 'api/seller/products', version: '1' })
export class SellerProductController {
  constructor(
    private readonly sellerProductService: SellerProductService,
    private readonly historyService: ProductStatusHistoryService,
  ) {}

  @Get()
  list(
    @CurrentSeller() seller: Seller,
    @Query() query: ListSellerProductQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.sellerProductService.list(seller, query, pagination);
  }

  // The status log of one of the seller's own products.
  @Get(':id/status-history')
  statusHistory(
    @CurrentSeller() seller: Seller,
    @Param('id', ParseIdPipe) id: number,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.historyService.listForSeller(seller, id, pagination);
  }

  @Get(':id')
  details(
    @CurrentSeller() seller: Seller,
    @Param('id', ParseIdPipe) id: number,
  ) {
    return this.sellerProductService.details(seller, id);
  }

  // A new product made from this one, switched off, so the seller can edit it before selling.
  // Switch many products on or off, or change their prices (100 at most).
  @Post('bulk')
  bulk(@CurrentSeller() seller: Seller, @Body() dto: BulkProductDto) {
    return this.sellerProductService.bulk(seller, dto);
  }

  @Post(':id/copy')
  copy(@CurrentSeller() seller: Seller, @Param('id', ParseIdPipe) id: number) {
    return this.sellerProductService.copy(seller, id);
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

  // Multipart: name, ringNumber, removeImage, image. Adds or changes the sire / dam of one option.
  @Put(':id/skus/:skuId/parents/:role')
  @UseInterceptors(PARENT_IMAGE)
  saveParent(
    @CurrentSeller() seller: Seller,
    @Param('id', ParseIdPipe) id: number,
    @Param('skuId', ParseIdPipe) skuId: number,
    @Param('role', new ParseEnumPipe(ParentRole, { exceptionFactory: () => new BadRequestException('role must be sire or dam') })) role: ParentRole,
    @Body() dto: SaveSkuParentDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.sellerProductService.saveParent(seller, id, skuId, role, dto, image);
  }

  // Delete is switched off for now. Remove these comment marks to bring it back.
  // @Delete(':id/skus/:skuId/parents/:role')
  // removeParent(
  //   @CurrentSeller() seller: Seller,
  //   @Param('id', ParseIdPipe) id: number,
  //   @Param('skuId', ParseIdPipe) skuId: number,
  //   @Param('role', new ParseEnumPipe(ParentRole, { exceptionFactory: () => new BadRequestException('role must be sire or dam') })) role: ParentRole,
  // ) {
  //   return this.sellerProductService.removeParent(seller, id, skuId, role);
  // }

  // Delete is switched off for now. Remove these comment marks to bring it back.
  // @Delete(':id')
  // remove(
  //   @CurrentSeller() seller: Seller,
  //   @Param('id', ParseIdPipe) id: number,
  // ) {
  //   return this.sellerProductService.remove(seller, id);
  // }
}
