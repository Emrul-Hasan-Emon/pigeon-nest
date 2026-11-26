import { Global, Module } from '@nestjs/common';
import { SellerDeviceController } from './controllers/seller-device.controller';
import { UserDeviceController } from './controllers/user-device.controller';
import { FcmSenderService } from './services/fcm-sender.service';
import { PushService } from './services/push.service';

// Global so any service can tell a seller or a buyer about something without importing this module.
@Global()
@Module({
  controllers: [SellerDeviceController, UserDeviceController],
  providers: [FcmSenderService, PushService],
  exports: [PushService],
})
export class PushModule {}
