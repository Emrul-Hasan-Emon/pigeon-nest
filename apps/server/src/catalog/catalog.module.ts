import { Module } from '@nestjs/common';
import { CategoryModule } from './category/category.module';
import { CollectionModule } from './collection/collection.module';
import { AttributeModule } from './attribute/attribute.module';
import { ProductModule } from './product/product.module';

@Module({
  imports: [CategoryModule, CollectionModule, AttributeModule, ProductModule],
})
export class CatalogModule {}
