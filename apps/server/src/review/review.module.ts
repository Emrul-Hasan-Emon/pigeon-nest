import { Module } from '@nestjs/common';
import { FileManagementModule } from '../file-management/file-management.module';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import { StorefrontModule } from '../storefront/storefront.module';
import {
  AdminReviewController,
  AdminReviewReplyController,
  AdminReviewReportController,
  AdminUserReviewController,
  PublicReviewController,
  SellerReviewController,
  SellerReviewReplyController,
  UserReviewController,
  UserReviewReplyController,
} from './controllers/review.controllers';
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
