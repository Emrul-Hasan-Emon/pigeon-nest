import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserAccessGuard } from '../../auth/guards/user-access.guard';
import { RequireUserAccess } from '../../auth/decorators/require-user-access.decorator';
import { CurrentUserAccount } from '../../auth/decorators/current-user-account.decorator';
import { User } from '../../database/entities/person/user.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ParseIdPipe } from '../../shared/pipes/parse-id.pipe';
import { CreateAddressDto, UpdateAddressDto } from '../dtos/address.dtos';
import { CommonUserService } from '../services/common-user.service';
import { UserProfileService } from '../services/user-profile.service';
import { UpdateUserProfileDto } from '../dtos/update-user-profile.dto';
import { ChangeUserPasswordDto } from '../dtos/change-user-password.dto';
import { UserAuthGuard } from '../../auth/guards/user-auth.guard';

const AVATAR_FILE = FileInterceptor('avatar', {
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

// A customer's own account: profile, password and address book.
@UseGuards(UserAuthGuard, UserAccessGuard)
@Controller({ path: 'api/user/profile', version: '1' })
export class UserProfileController {
  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly common: CommonUserService,
  ) {}

  private actor(user: User) {
    return { id: user.id, type: AuthUserType.USER, name: user.name };
  }

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

  // ---- address book

  @Get('addresses')
  listAddresses(@CurrentUserAccount() user: User) {
    return this.common.listAddresses(user.id);
  }

  @Post('addresses')
  createAddress(@CurrentUserAccount() user: User, @Body() dto: CreateAddressDto) {
    return this.common.createAddress(user.id, dto, this.actor(user));
  }

  @Get('addresses/:id')
  getAddress(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number) {
    return this.common.getAddress(user.id, id);
  }

  @Patch('addresses/:id')
  updateAddress(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number, @Body() dto: UpdateAddressDto) {
    return this.common.updateAddress(user.id, id, dto, this.actor(user));
  }

  @Delete('addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAddress(@CurrentUserAccount() user: User, @Param('id', ParseIdPipe) id: number) {
    return this.common.removeAddress(user.id, id, this.actor(user));
  }
}
