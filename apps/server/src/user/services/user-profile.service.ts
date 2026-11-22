import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { TokenService } from '../../auth/services/token.service';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../../database/database.service';
import { User } from '../../database/entities/person/user.entity';
import { ChangeUserPasswordDto } from '../dtos/change-user-password.dto';
import { UpdateUserProfileDto } from '../dtos/update-user-profile.dto';
import { CommonUserService } from './common-user.service';

@Injectable()
export class UserProfileService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly commonUserService: CommonUserService,
    private readonly tokens: TokenService,
  ) {}

  getProfile(user: User) {
    return this.commonUserService.toUserView(user);
  }

  async updateProfile(
    user: User,
    dto: UpdateUserProfileDto,
    avatar?: Express.Multer.File,
  ) {
    if (dto.email !== undefined && dto.email.toLowerCase() !== user.email?.toLowerCase()) {
      await this.commonUserService.assertEmailIsUnique(dto.email, user.id);
    }
    if (dto.phone !== undefined && dto.phone !== user.phone) {
      await this.commonUserService.assertPhoneIsUnique(dto.phone, user.id);
    }

    const saved = await this.commonUserService.runWithAvatar(
      avatar,
      async (manager, uploaded) => {
        const staleAvatarPath = uploaded ? user.avatarPath : null;
        if (dto.name !== undefined) user.name = dto.name;
        if (dto.email !== undefined) user.email = dto.email;
        if (dto.phone !== undefined) user.phone = dto.phone;
        if (uploaded) {
          user.avatarPath = uploaded.filePath;
          user.avatarUrl = uploaded.fileUrl;
        }
        return { result: await manager.save(user), staleAvatarPath };
      },
    );
    return this.commonUserService.toUserView(saved);
  }

  async changePassword(user: User, dto: ChangeUserPasswordDto) {
    const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from the current one',
      );
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.databaseService.user.update(user.id, { passwordHash });
    // Every older token stops working with the old password. This one keeps the caller signed in.
    return { updated: true, accessToken: await this.tokens.sign(AuthUserType.USER, { id: user.id, passwordHash }) };
  }
}
