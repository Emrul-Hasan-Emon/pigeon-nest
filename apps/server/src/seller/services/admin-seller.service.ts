import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../../database/database.service';
import { SellerActiveStatus } from '../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../database/enums/seller-status.enum';
import { CommissionType } from '../../database/enums/commission-type.enum';
import { SellerSettingType } from '../../database/enums/seller-setting-type.enum';
import { SellerStatusChangeAction } from '../../database/enums/seller-status-change-action.enum';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CreateSellerDto } from '../dtos/create-seller.dto';
import { UpdateSellerDto } from '../dtos/update-seller.dto';
import { ListSellerQueryDto } from '../dtos/list-seller-query.dto';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import { CommonSellerService, SellerImages } from './common-seller.service';
import { SellerStatusHistoryService } from './seller-status-history.service';
import { SellerSettingService } from '../../commission/services/seller-setting.service';
import { Seller } from '../../database/entities/seller/seller.entity';
import { SellerSetting } from '../../database/entities/commission/seller-setting.entity';
import { In } from 'typeorm';

@Injectable()
export class AdminSellerService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly commonSellerService: CommonSellerService,
    private readonly sellerStatusHistoryService: SellerStatusHistoryService,
    private readonly sellerSettings: SellerSettingService,
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

    const actor = await this.sellerStatusHistoryService.resolveActor(user);
    return this.commonSellerService.toSafeSeller(
      await this.commonSellerService.saveWithImages(
        seller,
        images,
        async (manager, saved) => {
          await this.sellerStatusHistoryService.record(manager, {
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
        ? await this.sellerStatusHistoryService.resolveActor(user)
        : undefined;

    return this.commonSellerService.toSafeSeller(
      await this.commonSellerService.saveWithImages(
        seller,
        images,
        actor &&
          (async (manager, saved) => {
            if (statusChanged) {
              await this.sellerStatusHistoryService.record(manager, {
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
}
