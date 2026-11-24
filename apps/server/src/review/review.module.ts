import { Module } from '@nestjs/common';
import { FileManagementModule } from '../file-management/file-management.module';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import { StorefrontModule } from '../storefront/storefront.module';
import { AdminReviewService } from './services/admin-review.service';
import { CommonReviewService } from './services/common-review.service';
import { SellerReviewService } from './services/seller-review.service';
import { UserReviewService } from './services/user-review.service';
import { AdminReviewController } from './controllers/admin-review.controller';
import { SellerReviewController } from './controllers/seller-review.controller';
import { UserReviewController } from './controllers/user-review.controller';

@Module({
  imports: [StorefrontModule, FileManagementModule],
  controllers: [UserReviewController, SellerReviewController, AdminReviewController],
  providers: [CommonReviewService, UserReviewService, SellerReviewService, AdminReviewService, ActorResolverService],
})
export class ReviewModule {}
