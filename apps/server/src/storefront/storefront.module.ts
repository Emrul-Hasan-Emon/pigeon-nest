import { Module } from '@nestjs/common';
import { StorefrontCategoryController } from './controllers/storefront-category.controller';
import { StorefrontCollectionController } from './controllers/storefront-collection.controller';
import { StorefrontProductController } from './controllers/storefront-product.controller';
import { StorefrontSellerController } from './controllers/storefront-seller.controller';
import { StorefrontProductDetailService } from './services/storefront-product-detail.service';
import { StorefrontSellerService } from './services/storefront-seller.service';
import { StorefrontCatalogService } from './services/storefront-catalog.service';
import { StorefrontProductService } from './storefront-product.service';

@Module({
  controllers: [
    StorefrontProductController,
    StorefrontCategoryController,
    StorefrontCollectionController,
    StorefrontSellerController,
  ],
  providers: [
    StorefrontProductService,
    StorefrontCatalogService,
    StorefrontProductDetailService,
    StorefrontSellerService,
  ],
  exports: [StorefrontProductService],
})
export class StorefrontModule {}
