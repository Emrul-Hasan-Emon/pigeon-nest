import { Module } from '@nestjs/common';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import { StorefrontModule } from '../storefront/storefront.module';
import { AdminProposalController } from './controllers/admin-proposal.controller';
import { SellerProposalController } from './controllers/seller-proposal.controller';
import { UserProposalController } from './controllers/user-proposal.controller';
import { SkuPriceProposalService } from './services/sku-price-proposal.service';

@Module({
  imports: [StorefrontModule],
  controllers: [UserProposalController, SellerProposalController, AdminProposalController],
  providers: [SkuPriceProposalService, ActorResolverService],
  exports: [SkuPriceProposalService],
})
export class ProposalModule {}
