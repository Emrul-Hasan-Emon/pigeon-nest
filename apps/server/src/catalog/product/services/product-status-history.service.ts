import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DatabaseService } from '../../../database/database.service';
import { SellerProductStatusChangeHistory } from '../../../database/entities/product/seller-product-status-change-history.entity';
import { Seller } from '../../../database/entities/seller/seller.entity';
import { AuthUserType } from '../../../database/enums/auth-user-type.enum';
import { ProductActiveStatus } from '../../../database/enums/product-active-status.enum';
import { ProductStatus } from '../../../database/enums/product-status.enum';
import { ProductStatusChangeAction } from '../../../database/enums/product-status-change-action.enum';
import { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';
import { CursorPagination } from '../../../shared/decorators/cursor-pagination-params.decorator';
import { Actor } from '../../../shared/types/actor.type';
import { getCursorPaginateData } from '../../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../../shared/utils/like.util';
import { ListProductStatusHistoryQueryDto } from '../dtos/list-product-status-history-query.dto';

export interface RecordProductStatusChangeInput {
  sellerProductId: number;
  fromStatus: ProductStatus | null;
  fromActiveStatus: ProductActiveStatus | null;
  toStatus: ProductStatus;
  toActiveStatus: ProductActiveStatus;
  action: ProductStatusChangeAction;
  reason?: string | null;
  actor: Actor;
}

// Append-only log of product status / activeStatus changes. Writers pass the
// EntityManager of the transaction that changes the product, so a change and
// its log row are saved together or not at all.
@Injectable()
export class ProductStatusHistoryService {
  constructor(private readonly databaseService: DatabaseService) {}

  async adminActor(user: JwtPayload): Promise<Actor> {
    const admin = await this.databaseService.adminUser.findOne({
      where: { id: user.sub },
      select: { id: true, name: true },
    });
    return {
      id: user.sub,
      type: AuthUserType.ADMIN,
      name: admin?.name ?? 'Admin',
    };
  }

  sellerActor(seller: Pick<Seller, 'id' | 'name'>): Actor {
    return { id: seller.id, type: AuthUserType.SELLER, name: seller.name };
  }

  async record(manager: EntityManager, input: RecordProductStatusChangeInput) {
    await manager.getRepository(SellerProductStatusChangeHistory).insert({
      sellerProductId: input.sellerProductId,
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

  // Newest first. Deleted products keep their history, so soft-deleted rows
  // are included in the joins.
  async list(
    query: ListProductStatusHistoryQueryDto,
    pagination: CursorPagination,
  ) {
    const qb = this.databaseService.sellerProductStatusChangeHistory
      .createQueryBuilder('history')
      .withDeleted()
      .leftJoin('history.product', 'product')
      .leftJoin('product.seller', 'seller')
      .addSelect([
        'product.id',
        'product.name',
        'product.sellerId',
        'seller.id',
        'seller.name',
      ])
      .orderBy('history.id', 'DESC')
      .take(pagination.limit);

    if (query.productId !== undefined) {
      qb.andWhere('history.sellerProductId = :productId', {
        productId: query.productId,
      });
    }
    if (query.search) {
      qb.andWhere(
        '(product.name ILIKE :search OR seller.name ILIKE :search OR seller.email ILIKE :search OR seller.phone ILIKE :search)',
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
