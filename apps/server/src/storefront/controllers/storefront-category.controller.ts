import { Controller, Get, Param } from '@nestjs/common';
import { StorefrontCatalogService } from '../services/storefront-catalog.service';

@Controller({ path: 'api/user/categories', version: '1' })
export class StorefrontCategoryController {
  constructor(private readonly catalog: StorefrontCatalogService) {}

  @Get('tree')
  tree() {
    return this.catalog.categoryTree();
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.catalog.categoryBySlug(slug);
  }
}
