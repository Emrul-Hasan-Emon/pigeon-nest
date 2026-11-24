import { Module } from '@nestjs/common';
import { SellerHelpController } from './controllers/seller-help.controller';
import { HelpContentService } from './services/help-content.service';

@Module({
  controllers: [SellerHelpController],
  providers: [HelpContentService],
  exports: [HelpContentService],
})
export class HelpModule {}
