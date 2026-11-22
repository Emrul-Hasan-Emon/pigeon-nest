import { Module } from '@nestjs/common';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import { StorefrontModule } from '../storefront/storefront.module';
import {
  AdminProposalController,
  SellerProposalController,
  UserProposalController,
} from './controllers/proposal.controllers';
import { SkuPriceProposalService } from './services/sku-price-proposal.service';

@Module({
  imports: [StorefrontModule],
  controllers: [UserProposalController, SellerProposalController, AdminProposalController],
  providers: [SkuPriceProposalService, ActorResolverService],
  exports: [SkuPriceProposalService],
})
export class ProposalModule {}
