import { Module } from '@nestjs/common';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import { AdminCountryController } from './controllers/admin-country.controller';
import { AdminSettingsController } from './controllers/admin-settings.controller';
import { AdminShippingZoneController } from './controllers/admin-shipping-zone.controller';
import { ShippingZoneService } from './services/shipping-zone.service';
import { SystemSettingsService } from './services/system-settings.service';

@Module({
  controllers: [AdminSettingsController, AdminCountryController, AdminShippingZoneController],
  providers: [SystemSettingsService, ShippingZoneService, ActorResolverService],
  exports: [SystemSettingsService, ShippingZoneService],
})
export class SettingsModule {}
