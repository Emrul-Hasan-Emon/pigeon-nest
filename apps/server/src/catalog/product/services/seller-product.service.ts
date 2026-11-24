import { ParentRole } from '../../../database/entities/product/seller-product-sku-parent.entity';
import { SaveSkuParentDto } from '../dtos/save-sku-parent.dto';
import { Injectable } from '@nestjs/common';
import { Seller } from '../../../database/entities/seller/seller.entity';
import { CursorPagination } from '../../../shared/decorators/cursor-pagination-params.decorator';
import { CreateSellerProductDto } from '../dtos/create-seller-product.dto';
import { UpdateSellerProductDto } from '../dtos/update-seller-product.dto';
import { ListSellerProductQueryDto } from '../dtos/list-seller-product-query.dto';
import { UpdateProductMediaFilesDto } from '../dtos/update-product-media-files.dto';
import {
  AdminProductService,
  ProductMediaFiles,
} from './admin-product.service';
import { ProductStatusHistoryService } from './product-status-history.service';
import { BulkProductDto } from '../dtos/bulk-product.dto';

// Seller-facing wrapper around the shared product engine. Every call is scoped
// to the calling seller (someone else's product is a 404) and the engine
// applies the rejected / suspended locks and the "seller can't set status or
// suspend" rules.
@Injectable()
export class SellerProductService {
  constructor(
    private readonly productService: AdminProductService,
    private readonly historyService: ProductStatusHistoryService,
  ) {}

  list(
    seller: Seller,
    query: ListSellerProductQueryDto,
    pagination: CursorPagination,
  ) {
    return this.productService.list(query, pagination, { sellerId: seller.id });
  }

  details(seller: Seller, id: number) {
    return this.productService.details(id, { sellerId: seller.id });
  }

  create(seller: Seller, dto: CreateSellerProductDto) {
    return this.productService.create(
      { ...dto, sellerId: seller.id },
      this.historyService.sellerActor(seller),
    );
  }

  update(seller: Seller, id: number, dto: UpdateSellerProductDto) {
    return this.productService.update(
      id,
      dto,
      this.historyService.sellerActor(seller),
      { sellerId: seller.id },
    );
  }

  updateMediaFiles(
    seller: Seller,
    id: number,
    dto: UpdateProductMediaFilesDto,
    files: ProductMediaFiles,
  ) {
    return this.productService.updateMediaFiles(id, dto, files, {
      sellerId: seller.id,
    });
  }

  saveParent(
    seller: Seller,
    id: number,
    skuId: number,
    role: ParentRole,
    dto: SaveSkuParentDto,
    file?: Express.Multer.File,
  ) {
    return this.productService.saveParent(id, skuId, role, dto, file, {
      sellerId: seller.id,
    });
  }

  removeParent(seller: Seller, id: number, skuId: number, role: ParentRole) {
    return this.productService.removeParent(id, skuId, role, {
      sellerId: seller.id,
    });
  }

  bulk(seller: Seller, dto: BulkProductDto) {
    return this.productService.bulkChange(dto, this.historyService.sellerActor(seller), { sellerId: seller.id });
  }

  copy(seller: Seller, id: number) {
    return this.productService.copy(id, this.historyService.sellerActor(seller), { sellerId: seller.id });
  }

  remove(seller: Seller, id: number) {
    return this.productService.remove(id, { sellerId: seller.id });
  }
}
