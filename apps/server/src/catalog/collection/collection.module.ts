import { Module } from '@nestjs/common';
import { AdminCollectionController } from './controllers/admin-collection.controller';
import { AdminCollectionService } from './services/admin-collection.service';

@Module({
  controllers: [AdminCollectionController],
  providers: [AdminCollectionService],
  exports: [AdminCollectionService],
})
export class CollectionModule {}
