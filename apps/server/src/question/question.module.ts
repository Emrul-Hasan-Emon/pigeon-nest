import { Module } from '@nestjs/common';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import { StorefrontModule } from '../storefront/storefront.module';
import { AdminQuestionController } from './controllers/admin-question.controller';
import { SellerQuestionController } from './controllers/seller-question.controller';
import { ProductQuestionController } from './controllers/product-question.controller';
import { UserQuestionController } from './controllers/user-question.controller';
import { AdminQuestionService } from './services/admin-question.service';
import { CommonQuestionService } from './services/common-question.service';
import { SellerQuestionService } from './services/seller-question.service';
import { UserQuestionService } from './services/user-question.service';

@Module({
  imports: [StorefrontModule],
  controllers: [ProductQuestionController, UserQuestionController, SellerQuestionController, AdminQuestionController],
  providers: [CommonQuestionService, UserQuestionService, SellerQuestionService, AdminQuestionService, ActorResolverService],
})
export class QuestionModule {}
