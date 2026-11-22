import {
  Body,
  Controller,
  Get,
  Patch,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserAccessGuard } from '../../auth/guards/user-access.guard';
import { RequireUserAccess } from '../../auth/decorators/require-user-access.decorator';
import { CurrentUserAccount } from '../../auth/decorators/current-user-account.decorator';
import { User } from '../../database/entities/person/user.entity';
import { UserProfileService } from '../services/user-profile.service';
import { UpdateUserProfileDto } from '../dtos/update-user-profile.dto';
import { ChangeUserPasswordDto } from '../dtos/change-user-password.dto';
import { UserAuthGuard } from '../../auth/guards/user-auth.guard';

const AVATAR_FILE = FileInterceptor('avatar', {
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

@UseGuards(UserAuthGuard, UserAccessGuard)
@Controller({ path: 'api/user/profile', version: '1' })
export class UserProfileController {
  constructor(private readonly userProfileService: UserProfileService) {}

  // Readable in every state (even suspended) so the user can see why.
  @Get()
  @RequireUserAccess('any')
  get(@CurrentUserAccount() user: User) {
    return this.userProfileService.getProfile(user);
  }

  // Multipart: name, email, phone (+countrycode), avatar. Active users only.
  @Patch()
  @UseInterceptors(AVATAR_FILE)
  update(
    @CurrentUserAccount() user: User,
    @Body() dto: UpdateUserProfileDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.userProfileService.updateProfile(user, dto, avatar);
  }

  // Active users only.
  @Patch('password')
  changePassword(
    @CurrentUserAccount() user: User,
    @Body() dto: ChangeUserPasswordDto,
  ) {
    return this.userProfileService.changePassword(user, dto);
  }
}
