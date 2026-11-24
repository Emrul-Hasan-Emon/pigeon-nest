import { Module } from '@nestjs/common';
import { StorefrontModule } from '../../storefront/storefront.module';
import { AdminHomepageSectionController } from './controllers/admin-homepage-section.controller';
import { AdminHomepageSlotController } from './controllers/admin-homepage-slot.controller';
import { StorefrontHomepageController } from './controllers/storefront-homepage.controller';
import { HomepageConfigService } from './services/homepage-config.service';
import { HomepageLookupService } from './services/homepage-lookup.service';
import { HomepageResolverService } from './services/homepage-resolver.service';
import { HomepageService } from './services/homepage.service';

@Module({
  imports: [StorefrontModule],
  controllers: [
    AdminHomepageSectionController,
    AdminHomepageSlotController,
    StorefrontHomepageController,
  ],
  providers: [
    HomepageService,
    HomepageConfigService,
    HomepageLookupService,
    HomepageResolverService,
  ],
})
export class HomepageModule {}
