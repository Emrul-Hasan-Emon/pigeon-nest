import { ConflictException, Injectable, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { Seller } from '../../database/entities/seller/seller.entity';
import { SellerActiveStatus } from '../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../database/enums/seller-status.enum';
import { SellerStatusChangeAction } from '../../database/enums/seller-status-change-action.enum';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { Actor } from '../../shared/types/actor.type';
import { ListSellerRequestQueryDto } from '../dtos/list-seller-request-query.dto';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import { SellerStatusChangeHistory } from '../../database/entities/seller/seller-status-change-history.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ListSellerStatusHistoryQueryDto } from '../dtos/list-seller-status-history-query.dto';
import { PageRequest, pageResult } from '../../shared/utils/page-paginate.util';
import { OnboardingFilter } from '../dtos/seller-onboarding-query.dto';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../../database/database.service';
import { CommissionType } from '../../database/enums/commission-type.enum';
import { SellerSettingType } from '../../database/enums/seller-setting-type.enum';
import { CreateSellerDto } from '../dtos/create-seller.dto';
import { UpdateSellerDto } from '../dtos/update-seller.dto';
import { ListSellerQueryDto } from '../dtos/list-seller-query.dto';
import { CommonSellerService, FLAGS, Flags, SellerImages } from './common-seller.service';
import { CommonCommissionService } from '../../commission/services/common-commission.service';
import { SellerSetting } from '../../database/entities/commission/seller-setting.entity';

@Injectable()
export class AdminSellerService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly commonSellerService: CommonSellerService,
    private readonly sellerSettings: CommonCommissionService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Both commission fields together, or neither. */
  private commissionRule(dto: { commissionType?: CommissionType; commissionAmount?: number }) {
    const { commissionType: type, commissionAmount: value } = dto;
    if ((type === undefined) !== (value === undefined)) {
      throw new BadRequestException('Send commissionType and commissionAmount together');
    }
    return type !== undefined && value !== undefined ? { type, value } : undefined;
  }

  /** Each seller's own commission rule, or null when the global one applies. */
  private async commissionFor(sellers: Seller[]) {
    const rows = sellers.length
      ? await this.databaseService.seller.manager.find(SellerSetting, {
          where: { sellerId: In(sellers.map((s) => s.id)), settingType: SellerSettingType.COMMISSION },
        })
      : [];
    const byId = new Map(rows.map((r) => [r.sellerId, r]));
    return (id: number) => {
      const row = byId.get(id);
      return row?.commissionType ? { type: row.commissionType, value: row.commissionAmount } : null;
    };
  }

  async list(query: ListSellerQueryDto, pagination: CursorPagination) {
    const qb = this.databaseService.seller
      .createQueryBuilder('seller')
      .orderBy('seller.id', 'DESC')
      .take(pagination.limit);

    if (query.search) {
      qb.andWhere(
        '(seller.name ILIKE :search OR seller.email ILIKE :search OR seller.phone ILIKE :search)',
        { search: likeContains(query.search) },
      );
    }
    if (query.status !== undefined) {
      qb.andWhere('seller.status = :status', { status: query.status });
    }
    if (query.activeStatus !== undefined) {
      qb.andWhere('seller.activeStatus = :activeStatus', {
        activeStatus: query.activeStatus,
      });
    }
    if (pagination.cursor > 0) {
      qb.andWhere('seller.id < :cursor', { cursor: pagination.cursor });
    }

    const results = await qb.getMany();
    const page = getCursorPaginateData(results, pagination.limit);

    const own = await this.commissionFor(page.results);
    const global = await this.sellerSettings.globalRule();
    return {
      ...page,
      results: page.results.map((seller) => ({
        ...this.commonSellerService.toSafeSeller(seller),
        // The rule that applies: the seller's own, else the global one.
        commission: own(seller.id)
          ? { ...own(seller.id), source: 'seller' as const }
          : { ...global, source: 'global' as const },
      })),
    };
  }

  async details(id: number) {
    const seller = await this.commonSellerService.findOrThrow(id);
    return {
      ...this.commonSellerService.toSafeSeller(seller),
      commission: (await this.sellerSettings.commissionView(id)).effective,
    };
  }

  async create(dto: CreateSellerDto, images: SellerImages, user: JwtPayload) {
    await this.commonSellerService.assertEmailIsUnique(dto.email);
    await this.commonSellerService.assertPhoneIsUnique(dto.phone);
    const rule = this.commissionRule(dto);

    const seller = this.databaseService.seller.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      description: dto.description ?? null,
      passwordHash: await bcrypt.hash(dto.password, 10),
      payoutAccountInfo: dto.payoutAccountInfo ?? null,
      status: SellerStatus.APPROVED,
      activeStatus: SellerActiveStatus.ACTIVE,
    });

    const actor = await this.commonSellerService.resolveActor(user);
    return this.commonSellerService.toSafeSeller(
      await this.commonSellerService.saveWithImages(
        seller,
        images,
        async (manager, saved) => {
          await this.commonSellerService.record(manager, {
            sellerId: saved.id,
            fromStatus: null,
            fromActiveStatus: null,
            toStatus: saved.status,
            toActiveStatus: saved.activeStatus,
            action: SellerStatusChangeAction.ADMIN_CREATED,
            actor,
          });
          if (rule) await this.sellerSettings.setCommission(manager, saved.id, rule, actor, 'Set when the seller was created');
        },
      ),
    );
  }

  async update(
    id: number,
    dto: UpdateSellerDto,
    images: SellerImages,
    user: JwtPayload,
  ) {
    const seller = await this.commonSellerService.findOrThrow(id);
    const rule = this.commissionRule(dto);
    const fromStatus = seller.status;
    const fromActiveStatus = seller.activeStatus;

    if (dto.name !== undefined) {
      seller.name = dto.name;
    }
    if (
      dto.email !== undefined &&
      dto.email.toLowerCase() !== seller.email?.toLowerCase()
    ) {
      await this.commonSellerService.assertEmailIsUnique(dto.email, id);
      seller.email = dto.email;
    }
    if (dto.phone !== undefined && dto.phone !== seller.phone) {
      await this.commonSellerService.assertPhoneIsUnique(dto.phone, id);
      seller.phone = dto.phone;
    }
    if (dto.description !== undefined) {
      seller.description = dto.description;
    }
    if (dto.password !== undefined) {
      seller.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    if (dto.payoutAccountInfo !== undefined) {
      seller.payoutAccountInfo = dto.payoutAccountInfo;
    }
    if (dto.status !== undefined) {
      seller.status = dto.status;
    }
    if (dto.activeStatus !== undefined) {
      seller.activeStatus = dto.activeStatus;
    }

    const statusChanged =
      seller.status !== fromStatus || seller.activeStatus !== fromActiveStatus;
    const becomesRejected =
      seller.status === SellerStatus.REJECTED &&
      fromStatus !== SellerStatus.REJECTED;
    const becomesSuspended =
      seller.activeStatus === SellerActiveStatus.SUSPENDED &&
      fromActiveStatus !== SellerActiveStatus.SUSPENDED;

    if ((becomesRejected || becomesSuspended) && !dto.reason) {
      throw new BadRequestException(
        'A reason is required when rejecting or suspending a seller',
      );
    }
    if (becomesRejected) {
      seller.rejectionReason = dto.reason ?? null;
    } else if (seller.status === SellerStatus.APPROVED) {
      seller.rejectionReason = null;
    }

    const actor =
      statusChanged || rule
        ? await this.commonSellerService.resolveActor(user)
        : undefined;

    return this.commonSellerService.toSafeSeller(
      await this.commonSellerService.saveWithImages(
        seller,
        images,
        actor &&
          (async (manager, saved) => {
            if (statusChanged) {
              await this.commonSellerService.record(manager, {
                sellerId: saved.id,
                fromStatus,
                fromActiveStatus,
                toStatus: saved.status,
                toActiveStatus: saved.activeStatus,
                action: SellerStatusChangeAction.ADMIN_UPDATED,
                reason: dto.reason,
                actor,
              });
            }
            if (rule) await this.sellerSettings.setCommission(manager, saved.id, rule, actor);
          }),
      ),
    );
  }

  // ---------------------------------------------------------------- sign-up requests

  // Sellers waiting for a decision (self-registered, or resubmitted after a
  // rejection), newest first.
  async listRequests(query: ListSellerRequestQueryDto, pagination: CursorPagination) {
    const qb = this.databaseService.seller
      .createQueryBuilder('seller')
      .where('seller.status = :status', { status: SellerStatus.PENDING })
      .orderBy('seller.id', 'DESC')
      .take(pagination.limit);

    if (query.search) {
      qb.andWhere(
        '(seller.name ILIKE :search OR seller.email ILIKE :search OR seller.phone ILIKE :search)',
        { search: likeContains(query.search) },
      );
    }
    if (pagination.cursor > 0) {
      qb.andWhere('seller.id < :cursor', { cursor: pagination.cursor });
    }

    const page = getCursorPaginateData(await qb.getMany(), pagination.limit);
    return {
      ...page,
      results: page.results.map((seller) =>
        this.commonSellerService.toSafeSeller(seller),
      ),
    };
  }

  // approved + active
  async approveRequest(id: number, user: JwtPayload) {
    const seller = await this.getDecidable(id, 'approved');
    const actor = await this.commonSellerService.resolveActor(user);
    await this.decide(
      seller,
      SellerStatus.APPROVED,
      SellerActiveStatus.ACTIVE,
      null,
      SellerStatusChangeAction.APPROVED,
      actor,
    );
    return this.reload(id);
  }

  // rejected + inactive, with a required reason the seller can read
  async rejectRequest(id: number, reason: string, user: JwtPayload) {
    const seller = await this.getDecidable(id, 'rejected');
    const actor = await this.commonSellerService.resolveActor(user);
    await this.decide(
      seller,
      SellerStatus.REJECTED,
      SellerActiveStatus.INACTIVE,
      reason,
      SellerStatusChangeAction.REJECTED,
      actor,
    );
    return this.reload(id);
  }

  // The update only matches a still-pending seller, so two admins deciding at
  // the same moment cannot both succeed (the second gets 409). The history
  // row is written in the same transaction.
  private async decide(
    seller: Seller,
    status: SellerStatus,
    activeStatus: SellerActiveStatus,
    reason: string | null,
    action: SellerStatusChangeAction,
    actor: Actor,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const result = await manager.getRepository(Seller).update(
        { id: seller.id, status: SellerStatus.PENDING },
        { status, activeStatus, rejectionReason: reason },
      );
      if (!result.affected) {
        throw new ConflictException('This request has already been decided');
      }
      await this.commonSellerService.record(manager, {
        sellerId: seller.id,
        fromStatus: seller.status,
        fromActiveStatus: seller.activeStatus,
        toStatus: status,
        toActiveStatus: activeStatus,
        action,
        reason,
        actor,
      });
    });
  }

  private async getDecidable(id: number, action: string): Promise<Seller> {
    const seller = await this.commonSellerService.findOrThrow(id);
    if (seller.status !== SellerStatus.PENDING) {
      throw new ConflictException(
        `Only pending sellers can be ${action} (this seller is ${seller.status})`,
      );
    }
    if (seller.activeStatus === SellerActiveStatus.SUSPENDED) {
      throw new ConflictException(
        `This seller is suspended; change the active status before ${action === 'approved' ? 'approving' : 'rejecting'}`,
      );
    }
    return seller;
  }

  private async reload(id: number) {
    return this.commonSellerService.toSafeSeller(
      await this.commonSellerService.findOrThrow(id),
    );
  }

  // ---------------------------------------------------------------- status history (read-only; sellers never see it)

  // Newest first. Optional filters; `sellerId` narrows it to one seller.
  async listStatusHistory(
    query: ListSellerStatusHistoryQueryDto,
    pagination: CursorPagination,
  ) {
    const qb = this.databaseService.sellerStatusChangeHistory
      .createQueryBuilder('history')
      .leftJoin('history.seller', 'seller')
      .addSelect(['seller.id', 'seller.name', 'seller.phone', 'seller.email'])
      .orderBy('history.id', 'DESC')
      .take(pagination.limit);

    if (query.sellerId !== undefined) {
      qb.andWhere('history.sellerId = :sellerId', { sellerId: query.sellerId });
    }
    if (query.search) {
      qb.andWhere(
        '(seller.name ILIKE :search OR seller.email ILIKE :search OR seller.phone ILIKE :search)',
        { search: likeContains(query.search) },
      );
    }
    if (query.action !== undefined) {
      qb.andWhere('history.action = :action', { action: query.action });
    }
    if (query.toStatus !== undefined) {
      qb.andWhere('history.toStatus = :toStatus', { toStatus: query.toStatus });
    }
    if (query.toActiveStatus !== undefined) {
      qb.andWhere('history.toActiveStatus = :toActiveStatus', {
        toActiveStatus: query.toActiveStatus,
      });
    }
    if (pagination.cursor > 0) {
      qb.andWhere('history.id < :cursor', { cursor: pagination.cursor });
    }

    return getCursorPaginateData(await qb.getMany(), pagination.limit);
  }

  // ---------------------------------------------------------------- shop set-up progress of every seller

  /** Every approved seller with how much of the checklist they have done, least done first. */
  async listOnboarding(search: string | undefined, show: OnboardingFilter | undefined, page: PageRequest) {
    const rows = await this.dataSource.query<(Flags & { id: number; name: string; phone: string | null; createdAt: Date })[]>(
      `select s.id, s.name, s.phone, s."createdAt", ${FLAGS} from seller s
        where s."deletedAt" is null and s.status = 'approved' and ($1::text is null or s.name ilike $1 or s.phone ilike $1)`,
      [search ? likeContains(search) : null],
    );
    const all = rows
      .map((r) => ({ id: r.id, name: r.name, phone: r.phone, joinedAt: r.createdAt, ...this.commonSellerService.onboardingView(r) }))
      .filter((r) => (show === OnboardingFilter.COMPLETE ? r.percent === 100 : show === OnboardingFilter.INCOMPLETE ? r.percent < 100 : true))
      .sort((a, b) => a.percent - b.percent || b.id - a.id);
    const results = all.slice(page.offset, page.offset + page.pageSize).map((r) => ({
      ...r,
      missing: r.steps.filter((s) => !s.done).map((s) => s.label),
      steps: undefined,
    }));
    const average = all.length ? Math.round(all.reduce((t, r) => t + r.percent, 0) / all.length) : 0;
    return { ...pageResult(results, all.length, page), summary: { sellers: all.length, complete: all.filter((r) => r.percent === 100).length, averagePercent: average } };
  }
}
