import { Module } from '@nestjs/common';
import { AdminBannerController } from './controllers/admin-banner.controller';
import { AdminBannerService } from './services/admin-banner.service';

@Module({
  controllers: [AdminBannerController],
  providers: [AdminBannerService],
  exports: [AdminBannerService],
})
export class BannerModule {}
