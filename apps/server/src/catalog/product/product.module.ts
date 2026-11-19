import { Module } from '@nestjs/common';
import { AdminProductController } from './controllers/admin-product.controller';
import { AdminProductService } from './services/admin-product.service';

@Module({
  controllers: [AdminProductController],
  providers: [AdminProductService],
})
export class ProductModule {}
