import { Module } from '@nestjs/common';
import { FileManagementModule } from '../file-management/file-management.module';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import { StorefrontModule } from '../storefront/storefront.module';
import { AdminReviewController } from './controllers/admin-review.controller';
import { AdminReviewReplyController } from './controllers/admin-review-reply.controller';
import { AdminReviewReportController } from './controllers/admin-review-report.controller';
import { AdminUserReviewController } from './controllers/admin-user-review.controller';
import { PublicReviewController } from './controllers/public-review.controller';
import { SellerReviewController } from './controllers/seller-review.controller';
import { SellerReviewReplyController } from './controllers/seller-review-reply.controller';
import { UserReviewController } from './controllers/user-review.controller';
import { UserReviewReplyController } from './controllers/user-review-reply.controller';
import { ReviewAdminService } from './services/review-admin.service';
import { ReviewCoreService } from './services/review-core.service';
import { ReviewEngagementService } from './services/review-engagement.service';
import { ReviewFileService } from './services/review-file.service';
import { ReviewPublicService } from './services/review-public.service';
import { ReviewReplyService } from './services/review-reply.service';
import { ReviewSellerService } from './services/review-seller.service';
import { ReviewService } from './services/review.service';

@Module({
  imports: [StorefrontModule, FileManagementModule],
  controllers: [
    PublicReviewController,
    UserReviewController,
    UserReviewReplyController,
    SellerReviewController,
    SellerReviewReplyController,
    AdminReviewController,
    AdminReviewReplyController,
    AdminReviewReportController,
    AdminUserReviewController,
  ],
  providers: [
    ReviewCoreService,
    ReviewFileService,
    ReviewService,
    ReviewPublicService,
    ReviewReplyService,
    ReviewEngagementService,
    ReviewSellerService,
    ReviewAdminService,
    ActorResolverService,
  ],
})
export class ReviewModule {}
