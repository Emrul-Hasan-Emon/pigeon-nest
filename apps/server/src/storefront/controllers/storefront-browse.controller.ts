import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { StorefrontSellerQueryDto } from '../dtos/storefront-seller-query.dto';
import { StorefrontProductDetailService } from '../services/storefront-product-detail.service';
import { StorefrontSellerService } from '../services/storefront-seller.service';
import { PageQueryDto, pageResult, resolvePage } from '../../shared/utils/page-paginate.util';
import { StorefrontProductQueryDto } from '../dtos/storefront-product-query.dto';
import { StorefrontCatalogService } from '../services/storefront-catalog.service';
import { StorefrontProductService } from '../storefront-product.service';

// Public browse APIs for the customer app: no login, only what is live.
@Controller({ path: 'api/user/products', version: '1' })
export class StorefrontProductController {
  constructor(
    private readonly products: StorefrontProductService,
    private readonly detail: StorefrontProductDetailService,
  ) {}

  @Get()
  async list(@Query() query: StorefrontProductQueryDto) {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      throw new BadRequestException('minPrice cannot be greater than maxPrice');
    }
    const page = resolvePage(query);
    const { items, total } = await this.products.search(
      {
        search: query.search,
        categoryId: query.categoryId,
        includeSubcategories: query.includeSubcategories,
        collectionId: query.collectionId,
        sellerId: query.sellerId,
        featured: query.featured,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        breed: query.breed,
        bloodline: query.bloodline,
        vaccinated: query.vaccinated,
        sort: query.sort,
      },
      page,
    );
    return pageResult(items, total, page);
  }

  // The breeds and bloodlines to offer as filters.
  @Get('bird-filters')
  birdFilters() {
    return this.products.birdFacets();
  }

  @Get(':id')
  details(@Param('id', ParseIdPipe) id: number) {
    return this.detail.details(id);
  }
}

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

@Controller({ path: 'api/user/sellers', version: '1' })
export class StorefrontSellerController {
  constructor(private readonly sellers: StorefrontSellerService) {}

  @Get()
  list(@Query() query: StorefrontSellerQueryDto) {
    return this.sellers.list(query.search, query.sort, resolvePage(query));
  }

  @Get(':id')
  details(@Param('id', ParseIdPipe) id: number) {
    return this.sellers.details(id);
  }
}
