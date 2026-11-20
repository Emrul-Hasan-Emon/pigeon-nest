import { Module } from '@nestjs/common';
import { AdminCategoryController } from './controllers/admin-category.controller';
import { AdminCategoryService } from './services/admin-category.service';

@Module({
  controllers: [AdminCategoryController],
  providers: [AdminCategoryService],
  exports: [AdminCategoryService],
})
export class CategoryModule {}
