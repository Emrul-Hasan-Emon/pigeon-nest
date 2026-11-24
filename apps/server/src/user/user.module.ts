import { Module } from '@nestjs/common';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import { AdminUserAddressController } from './controllers/admin-user-address.controller';
import { UserAddressController } from './controllers/user-address.controller';
import { AddressService } from './services/address.service';
import { AdminUserController } from './controllers/admin-user.controller';
import { AdminUserStatusHistoryController } from './controllers/admin-user-status-history.controller';
import { UserProfileController } from './controllers/user-profile.controller';
import { AdminUserService } from './services/admin-user.service';
import { CommonUserService } from './services/common-user.service';
import { UserProfileService } from './services/user-profile.service';

@Module({
  controllers: [
    AdminUserController,
    AdminUserStatusHistoryController,
    UserProfileController,
    UserAddressController,
    AdminUserAddressController,
  ],
  providers: [AdminUserService, CommonUserService, UserProfileService, AddressService, ActorResolverService],
  exports: [CommonUserService, AddressService],
})
export class UserModule {}
