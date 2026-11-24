import { Module } from '@nestjs/common';
import { CategoryModule } from '../category/category.module';
import { CollectionModule } from '../collection/collection.module';
import { AttributeModule } from '../attribute/attribute.module';
import { SellerCatalogController } from './controllers/seller-catalog.controller';
import { AdminProductController } from './controllers/admin-product.controller';
import { AdminProductStatusHistoryController } from './controllers/admin-product-status-history.controller';
import { SellerProductController } from './controllers/seller-product.controller';
import { AdminProductService } from './services/admin-product.service';
import { SellerProductService } from './services/seller-product.service';
import { ProductStatusHistoryService } from './services/product-status-history.service';
import { StockHistoryService } from './services/stock-history.service';

@Module({
  imports: [CategoryModule, CollectionModule, AttributeModule],
  controllers: [
    SellerCatalogController,
    AdminProductController,
    AdminProductStatusHistoryController,
    SellerProductController,
  ],
  providers: [
    AdminProductService,
    SellerProductService,
    ProductStatusHistoryService,
    StockHistoryService,
  ],
})
export class ProductModule {}
