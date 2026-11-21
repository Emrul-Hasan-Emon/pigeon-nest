import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Seller } from '../../database/entities/seller/seller.entity';
import { SellerSetting } from '../../database/entities/commission/seller-setting.entity';
import { SellerSettingHistory } from '../../database/entities/commission/seller-setting-history.entity';
import { CommissionType } from '../../database/enums/commission-type.enum';
import { SellerSettingType } from '../../database/enums/seller-setting-type.enum';
import { SystemSettingsService } from '../../settings/services/system-settings.service';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { Actor } from '../../shared/types/actor.type';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { ListSettingHistoryQueryDto } from '../dtos/commission.dtos';
import { assertValidRule, CommissionRule } from '../utils/commission-math.util';

export interface EffectiveCommission extends CommissionRule {
  // 'seller' when the seller has their own rule, 'global' when the system one applies.
  source: 'seller' | 'global';
}

/** Per-seller settings (commission for now) and the history of every change. */
@Injectable()
export class SellerSettingService {
  constructor(
    @InjectRepository(SellerSetting) private readonly settings: Repository<SellerSetting>,
    @InjectRepository(SellerSettingHistory) private readonly history: Repository<SellerSettingHistory>,
    @InjectRepository(Seller) private readonly sellers: Repository<Seller>,
    private readonly system: SystemSettingsService,
  ) {}

  async globalRule(): Promise<CommissionRule> {
    const [type, value] = await Promise.all([
      this.system.getString('commission.type'),
      this.system.getNumber('commission.amount'),
    ]);
    return { type: type as CommissionType, value };
  }

  /** The seller's own rule if there is one, otherwise the global one. */
  async effective(sellerId: number, manager?: EntityManager): Promise<EffectiveCommission> {
    const repo = manager ? manager.getRepository(SellerSetting) : this.settings;
    const own = await repo.findOne({ where: { sellerId, settingType: SellerSettingType.COMMISSION } });
    if (own?.commissionType && own.commissionAmount !== null) {
      return { type: own.commissionType, value: own.commissionAmount, source: 'seller' };
    }
    return { ...(await this.globalRule()), source: 'global' };
  }

  async commissionView(sellerId: number) {
    const own = await this.settings.findOne({ where: { sellerId, settingType: SellerSettingType.COMMISSION } });
    const effective = await this.effective(sellerId);
    return {
      sellerId,
      setting: own
        ? {
            id: own.id,
            settingType: own.settingType,
            commissionType: own.commissionType,
            commissionAmount: own.commissionAmount,
            updatedAt: own.updatedAt,
          }
        : null,
      global: await this.globalRule(),
      effective,
    };
  }

  async assertSellerExists(sellerId: number) {
    if (!(await this.sellers.exists({ where: { id: sellerId } }))) throw new NotFoundException('Seller not found');
  }

  /**
   * Create or change the seller's commission. Writes a history row when the
   * value really changes. Runs in the caller's transaction when one is given.
   */
  async setCommission(
    manager: EntityManager,
    sellerId: number,
    rule: CommissionRule,
    actor: Actor,
    note?: string | null,
  ) {
    assertValidRule(rule.type, rule.value);
    const repo = manager.getRepository(SellerSetting);
    const existing = await repo.findOne({
      where: { sellerId, settingType: SellerSettingType.COMMISSION },
      lock: { mode: 'pessimistic_write' },
    });
    const to = { commissionType: rule.type, commissionAmount: rule.value };
    const stamp = { updatedBy: actor.id, updaterType: actor.type, updaterName: actor.name };
    const creator = { createdBy: actor.id, creatorType: actor.type, creatorName: actor.name };

    if (!existing) {
      const saved = await repo.save({
        ...creator,
        ...stamp,
        sellerId,
        settingType: SellerSettingType.COMMISSION,
        commissionType: rule.type,
        commissionAmount: rule.value,
      });
      await manager.save(SellerSettingHistory, {
        ...creator,
        sellerId,
        settingId: saved.id,
        settingType: SellerSettingType.COMMISSION,
        action: 'created',
        fromValue: null,
        toValue: to,
        note: note ?? null,
      });
      return saved;
    }
    if (existing.commissionType === rule.type && existing.commissionAmount === rule.value) return existing;

    const from = { commissionType: existing.commissionType, commissionAmount: existing.commissionAmount };
    await repo.update(existing.id, { ...stamp, commissionType: rule.type, commissionAmount: rule.value });
    await manager.save(SellerSettingHistory, {
      ...creator,
      sellerId,
      settingId: existing.id,
      settingType: SellerSettingType.COMMISSION,
      action: 'updated',
      fromValue: from,
      toValue: to,
      note: note ?? null,
    });
    return { ...existing, commissionType: rule.type, commissionAmount: rule.value };
  }

  /** setCommission in a transaction of its own. */
  changeCommission(sellerId: number, rule: CommissionRule, actor: Actor, note?: string | null) {
    return this.settings.manager.transaction((manager) => this.setCommission(manager, sellerId, rule, actor, note));
  }

  /** Every change to seller settings, newest first. A seller id limits it to one seller. */
  async listHistory(query: ListSettingHistoryQueryDto, pagination: CursorPagination, sellerId?: number) {
    const qb = this.history
      .createQueryBuilder('h')
      .leftJoin(Seller, 's', 's.id = h."sellerId"')
      .select([
        'h.id AS id',
        'h."sellerId" AS "sellerId"',
        's.name AS "sellerName"',
        'h."settingType" AS "settingType"',
        'h.action AS action',
        'h."fromValue" AS "fromValue"',
        'h."toValue" AS "toValue"',
        'h.note AS note',
        'h."createdAt" AS "changedAt"',
        'h."createdBy" AS "changedBy"',
        'h."creatorType" AS "changedByType"',
        'h."creatorName" AS "changedByName"',
      ])
      .orderBy('h.id', 'DESC')
      .limit(pagination.limit);
    const scope = sellerId ?? query.sellerId;
    if (scope !== undefined) qb.andWhere('h."sellerId" = :scope', { scope });
    if (query.settingType) qb.andWhere('h."settingType" = :st', { st: query.settingType });
    if (query.from) qb.andWhere('h."createdAt" >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('h."createdAt" <= :to', { to: new Date(query.to) });
    if (pagination.cursor > 0) qb.andWhere('h.id < :cursor', { cursor: pagination.cursor });
    return getCursorPaginateData(await qb.getRawMany<{ id: number }>(), pagination.limit);
  }
}
