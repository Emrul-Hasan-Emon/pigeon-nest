import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SellerAccessGuard } from '../../../auth/guards/seller-access.guard';
import { RequireSellerAccess } from '../../../auth/decorators/require-seller-access.decorator';
import {
  CursorPaginationParams,
  CursorPagination,
} from '../../../shared/decorators/cursor-pagination-params.decorator';
import { AdminCategoryService } from '../../category/services/admin-category.service';
import { AdminCollectionService } from '../../collection/services/admin-collection.service';
import { AdminAttributeService } from '../../attribute/services/admin-attribute.service';
import { ListCollectionQueryDto } from '../../collection/dtos/list-collection-query.dto';
import { ListAttributeQueryDto } from '../../attribute/dtos/list-attribute-query.dto';
import { SellerAuthGuard } from '../../../auth/guards/seller-auth.guard';

// Read-only lookups a seller needs to fill in a product form (categories,
// collections, attributes). Only active collections and attributes are
// offered; sellers cannot change any of them.
@UseGuards(SellerAuthGuard, SellerAccessGuard)
@RequireSellerAccess('full')
@Controller({ path: 'api/seller/catalog', version: '1' })
export class SellerCatalogController {
  constructor(
    private readonly categoryService: AdminCategoryService,
    private readonly collectionService: AdminCollectionService,
    private readonly attributeService: AdminAttributeService,
  ) {}

  @Get('categories/tree')
  categoryTree() {
    return this.categoryService.tree({});
  }

  @Get('collections')
  collections(
    @Query() query: ListCollectionQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.collectionService.list(
      { ...query, isActive: true },
      pagination,
    );
  }

  @Get('attributes')
  attributes(
    @Query() query: ListAttributeQueryDto,
    @CursorPaginationParams() pagination: CursorPagination,
  ) {
    return this.attributeService.list({ ...query, isActive: true }, pagination);
  }
}
