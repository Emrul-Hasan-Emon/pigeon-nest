import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DatabaseService } from '../../database/database.service';
import { SellerStatusChangeHistory } from '../../database/entities/seller/seller-status-change-history.entity';
import { Seller } from '../../database/entities/seller/seller.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { SellerActiveStatus } from '../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../database/enums/seller-status.enum';
import { SellerStatusChangeAction } from '../../database/enums/seller-status-change-action.enum';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { Actor } from '../../shared/types/actor.type';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import { ListSellerStatusHistoryQueryDto } from '../dtos/list-seller-status-history-query.dto';

export interface RecordStatusChangeInput {
  sellerId: number;
  fromStatus: SellerStatus | null;
  fromActiveStatus: SellerActiveStatus | null;
  toStatus: SellerStatus;
  toActiveStatus: SellerActiveStatus;
  action: SellerStatusChangeAction;
  reason?: string | null;
  actor: Actor;
}

// Append-only log of seller status / activeStatus changes. Writers pass the
// EntityManager of the transaction that changes the seller, so a change and
// its log row are saved together or not at all.
@Injectable()
export class SellerStatusHistoryService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Tracker fields store the name as it is now, so the log stays readable
  // even if the person is renamed later.
  async resolveActor(user: JwtPayload): Promise<Actor> {
    if (user.type === AuthUserType.ADMIN) {
      const admin = await this.databaseService.adminUser.findOne({
        where: { id: user.sub },
        select: { id: true, name: true },
      });
      return { id: user.sub, type: user.type, name: admin?.name ?? 'Admin' };
    }
    const seller = await this.databaseService.seller.findOne({
      where: { id: user.sub },
      select: { id: true, name: true },
    });
    return { id: user.sub, type: user.type, name: seller?.name ?? 'Seller' };
  }

  sellerActor(seller: Pick<Seller, 'id' | 'name'>): Actor {
    return { id: seller.id, type: AuthUserType.SELLER, name: seller.name };
  }

  async record(manager: EntityManager, input: RecordStatusChangeInput) {
    await manager.getRepository(SellerStatusChangeHistory).insert({
      sellerId: input.sellerId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      fromActiveStatus: input.fromActiveStatus,
      toActiveStatus: input.toActiveStatus,
      action: input.action,
      reason: input.reason ?? null,
      createdBy: input.actor.id,
      creatorType: input.actor.type,
      creatorName: input.actor.name,
    });
  }

  // Newest first. Optional filters; `sellerId` narrows it to one seller.
  async list(
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
}
