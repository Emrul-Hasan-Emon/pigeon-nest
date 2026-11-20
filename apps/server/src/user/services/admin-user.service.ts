import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../../database/database.service';
import { User } from '../../database/entities/person/user.entity';
import { UserStatus } from '../../database/enums/user-status.enum';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { ListUserQueryDto } from '../dtos/list-user-query.dto';
import { ListUserStatusHistoryQueryDto } from '../dtos/list-user-status-history-query.dto';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import { CommonUserService } from './common-user.service';

@Injectable()
export class AdminUserService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly commonUserService: CommonUserService,
  ) {}

  async list(query: ListUserQueryDto, pagination: CursorPagination) {
    const qb = this.databaseService.user
      .createQueryBuilder('user')
      .orderBy('user.id', 'DESC')
      .take(pagination.limit);

    if (query.search) {
      qb.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search)',
        { search: likeContains(query.search) },
      );
    }
    if (query.status !== undefined) {
      qb.andWhere('user.status = :status', { status: query.status });
    }
    if (pagination.cursor > 0) {
      qb.andWhere('user.id < :cursor', { cursor: pagination.cursor });
    }

    const page = getCursorPaginateData(await qb.getMany(), pagination.limit);
    return {
      ...page,
      results: page.results.map((user) => this.commonUserService.toSafeUser(user)),
    };
  }

  async details(id: number) {
    return this.commonUserService.toSafeUser(
      await this.commonUserService.findOrThrow(id),
    );
  }

  // Newest first. The log is append-only; nothing here edits or removes rows.
  // `userId` narrows it to one user (user details page).
  async statusHistory(
    query: ListUserStatusHistoryQueryDto,
    pagination: CursorPagination,
  ) {
    const qb = this.databaseService.userStatusChangeHistory
      .createQueryBuilder('entry')
      .leftJoin('entry.user', 'user')
      .addSelect(['user.id', 'user.name', 'user.phone', 'user.email'])
      .orderBy('entry.id', 'DESC')
      .take(pagination.limit);

    if (query.userId !== undefined) {
      qb.andWhere('entry.userId = :userId', { userId: query.userId });
    }
    if (query.search) {
      qb.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search)',
        { search: likeContains(query.search) },
      );
    }
    if (query.fromStatus !== undefined) {
      qb.andWhere('entry.fromStatus = :fromStatus', {
        fromStatus: query.fromStatus,
      });
    }
    if (query.toStatus !== undefined) {
      qb.andWhere('entry.toStatus = :toStatus', { toStatus: query.toStatus });
    }
    if (pagination.cursor > 0) {
      qb.andWhere('entry.id < :cursor', { cursor: pagination.cursor });
    }

    return getCursorPaginateData(await qb.getMany(), pagination.limit);
  }

  // Admin-created users are always active; the creation is the first log entry.
  async create(
    dto: CreateUserDto,
    adminPayload: JwtPayload,
    avatar?: Express.Multer.File,
  ) {
    const actor = await this.commonUserService.resolveAdminActor(adminPayload);
    await this.commonUserService.assertPhoneIsUnique(dto.phone);
    await this.commonUserService.assertEmailIsUnique(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const created = await this.commonUserService.runWithAvatar(
      avatar,
      async (manager, uploaded) => {
        const user = await manager.save(
          manager.create(User, {
            name: dto.name,
            phone: dto.phone,
            email: dto.email,
            passwordHash,
            status: UserStatus.ACTIVE,
            suspensionReason: null,
            avatarUrl: uploaded?.fileUrl,
            avatarPath: uploaded?.filePath,
            createdBy: actor.id,
            creatorType: actor.type,
            creatorName: actor.name,
          }),
        );
        await this.commonUserService.recordStatusChange(manager, {
          userId: user.id,
          fromStatus: null,
          toStatus: UserStatus.ACTIVE,
          reason: 'Created by admin',
          actor,
        });
        return { result: user };
      },
    );
    return this.commonUserService.toSafeUser(created);
  }

  async update(
    id: number,
    dto: UpdateUserDto,
    adminPayload: JwtPayload,
    avatar?: Express.Multer.File,
  ) {
    if (dto.statusReason !== undefined && dto.status === undefined) {
      throw new BadRequestException('statusReason can only be sent with status');
    }
    const actor = await this.commonUserService.resolveAdminActor(adminPayload);
    const current = await this.commonUserService.findOrThrow(id);

    if (dto.email !== undefined && dto.email.toLowerCase() !== current.email?.toLowerCase()) {
      await this.commonUserService.assertEmailIsUnique(dto.email, id);
    }
    if (dto.phone !== undefined && dto.phone !== current.phone) {
      await this.commonUserService.assertPhoneIsUnique(dto.phone, id);
    }
    const passwordHash =
      dto.password !== undefined ? await bcrypt.hash(dto.password, 10) : undefined;

    const updated = await this.commonUserService.runWithAvatar(
      avatar,
      async (manager, uploaded) => {
        // Lock the row so the logged "from" status is the real previous one
        // even if two admins change the status at the same moment.
        const user = await manager.findOne(User, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user) {
          throw new NotFoundException('User not found');
        }

        if (dto.name !== undefined) user.name = dto.name;
        if (dto.email !== undefined) user.email = dto.email;
        if (dto.phone !== undefined) user.phone = dto.phone;
        if (passwordHash !== undefined) user.passwordHash = passwordHash;

        let statusChange: { from: UserStatus; to: UserStatus } | null = null;
        if (dto.status !== undefined) {
          if (dto.status === user.status) {
            if (dto.statusReason !== undefined) {
              throw new BadRequestException(
                `statusReason can only be sent with a status change (the user is already ${user.status})`,
              );
            }
          } else {
            if (dto.status === UserStatus.SUSPENDED && !dto.statusReason) {
              throw new BadRequestException(
                'A reason is required to suspend a user',
              );
            }
            statusChange = { from: user.status, to: dto.status };
            user.status = dto.status;
            user.suspensionReason =
              dto.status === UserStatus.SUSPENDED ? (dto.statusReason ?? null) : null;
          }
        }

        const staleAvatarPath = uploaded ? user.avatarPath : null;
        if (uploaded) {
          user.avatarPath = uploaded.filePath;
          user.avatarUrl = uploaded.fileUrl;
        }
        user.updatedBy = actor.id;
        user.updaterType = actor.type;
        user.updaterName = actor.name;

        const saved = await manager.save(user);
        if (statusChange) {
          await this.commonUserService.recordStatusChange(manager, {
            userId: id,
            fromStatus: statusChange.from,
            toStatus: statusChange.to,
            reason: dto.statusReason ?? null,
            actor,
          });
        }
        return { result: saved, staleAvatarPath };
      },
    );
    return this.commonUserService.toSafeUser(updated);
  }
}
