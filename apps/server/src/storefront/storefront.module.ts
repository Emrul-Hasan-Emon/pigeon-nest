import { Module } from '@nestjs/common';
import {
  StorefrontCategoryController,
  StorefrontCollectionController,
  StorefrontProductController,
  StorefrontSellerController,
} from './controllers/storefront-browse.controller';
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
