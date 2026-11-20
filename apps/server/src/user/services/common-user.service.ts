import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { DatabaseService } from '../../database/database.service';
import { FileUploadService } from '../../file-management/file-upload.service';
import { FileInfo } from '../../file-management/types/file-info.type';
import { User } from '../../database/entities/person/user.entity';
import { UserStatusChangeHistory } from '../../database/entities/person/user-status-change-history.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { UserStatus } from '../../database/enums/user-status.enum';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { getUserAccess } from '../../auth/policies/user-access.policy';
import { assertUploadAllowed } from '../../shared/utils/upload-validation.util';

const AVATAR_FOLDER = 'users/avatars';
const AVATAR_MAX_BYTES = 10 * 1024 * 1024;

// Who performed an action; written to the tracker fields.
export interface Actor {
  id: number;
  type: AuthUserType;
  name: string;
}

export interface StatusChange {
  userId: number;
  fromStatus: UserStatus | null;
  toStatus: UserStatus;
  reason: string | null;
  actor: Actor;
}

export interface AvatarWork<T> {
  result: T;
  // Path of the avatar that was replaced; deleted after the commit.
  staleAvatarPath?: string | null;
}

// Logic shared by the admin user APIs, user self-service and registration.
@Injectable()
export class CommonUserService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly fileUploadService: FileUploadService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findOrThrow(id: number): Promise<User> {
    const user = await this.databaseService.user.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async assertEmailIsUnique(email?: string | null, excludeId?: number) {
    if (!email) return;
    const qb = this.databaseService.user
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email });
    if (excludeId) qb.andWhere('user.id != :excludeId', { excludeId });
    if (await qb.getExists()) {
      throw new BadRequestException('A user with this email already exists');
    }
  }

  async assertPhoneIsUnique(phone?: string | null, excludeId?: number) {
    if (!phone) return;
    const qb = this.databaseService.user
      .createQueryBuilder('user')
      .where('user.phone = :phone', { phone });
    if (excludeId) qb.andWhere('user.id != :excludeId', { excludeId });
    if (await qb.getExists()) {
      throw new BadRequestException('A user with this phone already exists');
    }
  }

  // Validates the avatar, uploads it, runs `work` in one transaction and then
  // deletes the replaced file. If anything fails the new upload is removed
  // again, so a failure never leaves orphans or loses the old file.
  async runWithAvatar<T>(
    avatar: Express.Multer.File | undefined,
    work: (manager: EntityManager, uploaded?: FileInfo) => Promise<AvatarWork<T>>,
  ): Promise<T> {
    if (avatar) {
      assertUploadAllowed(avatar, ['image']);
      if (avatar.size > AVATAR_MAX_BYTES) {
        throw new PayloadTooLargeException('avatar must be 10MB or smaller');
      }
    }

    let uploaded: FileInfo | undefined;
    try {
      if (avatar) {
        uploaded = await this.fileUploadService.uploadFile(avatar, AVATAR_FOLDER);
      }
      const { result, staleAvatarPath } = await this.dataSource.transaction(
        (manager) => work(manager, uploaded),
      );
      if (staleAvatarPath) {
        await this.fileUploadService
          .removeFile(staleAvatarPath)
          .catch(() => undefined);
      }
      return result;
    } catch (error) {
      if (uploaded) {
        await this.fileUploadService
          .removeFile(uploaded.filePath)
          .catch(() => undefined);
      }
      throw this.mapUniqueViolation(error);
    }
  }

  // Appends one row to the status log. Never updated or deleted afterwards.
  async recordStatusChange(manager: EntityManager, change: StatusChange) {
    await manager.save(
      manager.create(UserStatusChangeHistory, {
        userId: change.userId,
        fromStatus: change.fromStatus,
        toStatus: change.toStatus,
        reason: change.reason,
        createdBy: change.actor.id,
        creatorType: change.actor.type,
        creatorName: change.actor.name,
      }),
    );
  }

  async resolveAdminActor(payload: JwtPayload): Promise<Actor> {
    const admin = await this.databaseService.adminUser.findOne({
      where: { id: payload.sub },
    });
    if (!admin) {
      throw new UnauthorizedException('Admin account no longer exists');
    }
    return { id: admin.id, type: AuthUserType.ADMIN, name: admin.name };
  }

  // Turns a race on the phone/email unique constraints into a clean 400.
  mapUniqueViolation(error: unknown): unknown {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string } | undefined)?.code === '23505'
    ) {
      return new BadRequestException(
        'A user with this phone or email already exists',
      );
    }
    return error;
  }

  toSafeUser(user: User) {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  // What a user sees about themselves: safe fields + what they may do.
  toUserView(user: User) {
    return { ...this.toSafeUser(user), access: getUserAccess(user) };
  }
}
