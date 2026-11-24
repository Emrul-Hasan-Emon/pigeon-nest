import { Module } from '@nestjs/common';
import { CommissionModule } from '../commission/commission.module';
import { FileManagementModule } from '../file-management/file-management.module';
import { AttachmentFileService } from '../shared/services/attachment-file.service';
import { SettingsModule } from '../settings/settings.module';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import { AdminReturnController } from './controllers/admin-return.controller';
import { SellerReturnController } from './controllers/seller-return.controller';
import { UserReturnController } from './controllers/user-return.controller';
import { AdminReturnService } from './services/admin-return.service';
import { CommonReturnService } from './services/common-return.service';
import { ReturnViewService } from './services/return-view.service';
import { SellerReturnService } from './services/seller-return.service';
import { UserReturnService } from './services/user-return.service';

@Module({
  imports: [CommissionModule, SettingsModule, FileManagementModule],
  controllers: [UserReturnController, SellerReturnController, AdminReturnController],
  providers: [
    CommonReturnService,
    UserReturnService,
    SellerReturnService,
    AdminReturnService,
    ReturnViewService,
    AttachmentFileService,
    ActorResolverService,
  ],
  exports: [ReturnViewService],
})
export class ReturnsModule {}
