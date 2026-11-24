import { Controller, Get, Param, Query } from '@nestjs/common';
import { PageQueryDto, resolvePage } from '../../shared/utils/page-paginate.util';
import { StorefrontCatalogService } from '../services/storefront-catalog.service';

@Controller({ path: 'api/user/collections', version: '1' })
export class StorefrontCollectionController {
  constructor(private readonly catalog: StorefrontCatalogService) {}

  @Get()
  list(@Query() query: PageQueryDto) {
    return this.catalog.collections(resolvePage(query));
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.catalog.collectionBySlug(slug);
  }
}
