import {
  BadRequestException,
  ConflictException,
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
import { Address } from '../../database/entities/person/address.entity';
import { AddressType } from '../../database/enums/address-type.enum';
import { countryName } from '../../settings/utils/countries';
import { Actor as AuditActor } from '../../shared/types/actor.type';
import { CreateAddressDto, UpdateAddressDto } from '../dtos/address.dtos';
import { assertUploadAllowed } from '../../shared/utils/upload-validation.util';

export const MAX_ADDRESSES = 20;
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

// Logic shared by the admin user APIs, user self-service and registration: user rows and avatars,
// the status-change log and the saved address book (a customer manages their own; an admin and a seller can act for them).
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

  // ---------------------------------------------------------------- address book

  async listAddresses(userId: number) {
    const rows = await this.databaseService.address.find({ where: { userId }, order: { isDefault: 'DESC', id: 'DESC' } });
    return { results: rows.map((a) => this.addressView(a)) };
  }

  async getAddress(userId: number, id: number) {
    return this.addressView(await this.findAddressOrThrow(userId, id));
  }

  async createAddress(userId: number, dto: CreateAddressDto, actor: AuditActor) {
    const saved = await this.databaseService.address.manager.transaction(async (manager) => {
      // The customer row serialises changes to their addresses (one default, a cap on the count).
      await manager.query(`SELECT id FROM "user" WHERE id = $1 FOR UPDATE`, [userId]);
      const existing = await manager.count(Address, { where: { userId } });
      if (existing >= MAX_ADDRESSES) {
        throw new ConflictException(`A customer can save at most ${MAX_ADDRESSES} addresses. Delete one first.`);
      }
      // The first address is the default; asking for a default replaces the old one.
      const makeDefault = existing === 0 || dto.isDefault === true;
      if (makeDefault) await manager.update(Address, { userId, isDefault: true }, { isDefault: false });
      return manager.save(Address, {
        userId,
        type: dto.type ?? AddressType.SHIPPING,
        recipientName: dto.recipientName,
        phone: dto.phone,
        countryCode: dto.countryCode,
        state: dto.state ?? null,
        city: dto.city,
        address: dto.address,
        zipCode: dto.zipCode ?? null,
        isDefault: makeDefault,
        createdBy: actor.id,
        creatorType: actor.type,
        creatorName: actor.name,
      });
    });
    return this.addressView(saved);
  }

  async updateAddress(userId: number, id: number, dto: UpdateAddressDto, actor: AuditActor) {
    await this.databaseService.address.manager.transaction(async (manager) => {
      await manager.query(`SELECT id FROM "user" WHERE id = $1 FOR UPDATE`, [userId]);
      const address = await manager.findOne(Address, { where: { id, userId } });
      if (!address) throw new NotFoundException('Address not found');
      if (dto.isDefault === true && !address.isDefault) {
        await manager.update(Address, { userId, isDefault: true }, { isDefault: false });
      }
      const { isDefault, ...fields } = dto;
      await manager.update(Address, id, {
        ...fields,
        // The default cannot be switched off directly: choose another address as the default instead.
        ...(isDefault === true ? { isDefault: true } : {}),
        updatedBy: actor.id,
        updaterType: actor.type,
        updaterName: actor.name,
      });
    });
    return this.getAddress(userId, id);
  }

  async removeAddress(userId: number, id: number, actor: AuditActor) {
    await this.databaseService.address.manager.transaction(async (manager) => {
      await manager.query(`SELECT id FROM "user" WHERE id = $1 FOR UPDATE`, [userId]);
      const address = await manager.findOne(Address, { where: { id, userId } });
      if (!address) throw new NotFoundException('Address not found');
      await manager.update(Address, id, {
        isDefault: false,
        updatedBy: actor.id,
        updaterType: actor.type,
        updaterName: actor.name,
      });
      await manager.softDelete(Address, id);
      // Deleting the default hands the role to the newest address that is left.
      if (address.isDefault) {
        const next = await manager.findOne(Address, { where: { userId }, order: { id: 'DESC' } });
        if (next) await manager.update(Address, next.id, { isDefault: true });
      }
    });
  }

  async ensureUser(userId: number) {
    const user = await this.databaseService.user.findOne({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
  }

  /** For someone saving an address on a customer's behalf: the account must exist and be usable. */
  async ensureActiveUser(userId: number) {
    const user = await this.databaseService.user.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!getUserAccess(user).canUse) throw new BadRequestException('That customer account is suspended');
  }

  private async findAddressOrThrow(userId: number, id: number) {
    const address = await this.databaseService.address.findOne({ where: { id, userId } });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  private addressView(a: Address) {
    return {
      id: a.id,
      userId: a.userId,
      type: a.type,
      recipientName: a.recipientName,
      phone: a.phone,
      countryCode: a.countryCode,
      countryName: countryName(a.countryCode),
      state: a.state,
      city: a.city,
      address: a.address,
      zipCode: a.zipCode,
      isDefault: a.isDefault,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }
}
