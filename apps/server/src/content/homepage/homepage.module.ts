import { Module } from '@nestjs/common';
import { StorefrontModule } from '../../storefront/storefront.module';
import { AdminHomepageController } from './controllers/admin-homepage.controller';
import { StorefrontHomepageController } from './controllers/storefront-homepage.controller';
import { AdminHomepageService } from './services/admin-homepage.service';
import { CommonHomepageService } from './services/common-homepage.service';
import { StorefrontHomepageService } from './services/storefront-homepage.service';

@Module({
  imports: [StorefrontModule],
  controllers: [AdminHomepageController, StorefrontHomepageController],
  providers: [AdminHomepageService, StorefrontHomepageService, CommonHomepageService],
})
export class HomepageModule {}
