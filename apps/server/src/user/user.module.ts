import { Module } from '@nestjs/common';
import { ActorResolverService } from '../shared/services/actor-resolver.service';
import { AdminUserController } from './controllers/admin-user.controller';
import { UserProfileController } from './controllers/user-profile.controller';
import { AdminUserService } from './services/admin-user.service';
import { CommonUserService } from './services/common-user.service';
import { UserProfileService } from './services/user-profile.service';

@Module({
  controllers: [AdminUserController, UserProfileController],
  providers: [AdminUserService, CommonUserService, UserProfileService, ActorResolverService],
  exports: [CommonUserService],
})
export class UserModule {}
