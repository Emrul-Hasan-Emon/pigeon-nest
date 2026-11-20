import { Module } from '@nestjs/common';
import { BannerModule } from './banner/banner.module';
import { HomepageModule } from './homepage/homepage.module';

@Module({
  imports: [BannerModule, HomepageModule],
})
export class ContentModule {}
