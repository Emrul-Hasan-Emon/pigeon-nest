import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatabaseService } from '../../database/database.service';
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
import { CommonSellerService } from './common-seller.service';
import { SellerStatusHistoryService } from './seller-status-history.service';

@Injectable()
export class AdminSellerRequestService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly commonSellerService: CommonSellerService,
    private readonly sellerStatusHistoryService: SellerStatusHistoryService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Sellers waiting for a decision (self-registered, or resubmitted after a
  // rejection), newest first.
  async list(query: ListSellerRequestQueryDto, pagination: CursorPagination) {
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
  async approve(id: number, user: JwtPayload) {
    const seller = await this.getDecidable(id, 'approved');
    const actor = await this.sellerStatusHistoryService.resolveActor(user);
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
  async reject(id: number, reason: string, user: JwtPayload) {
    const seller = await this.getDecidable(id, 'rejected');
    const actor = await this.sellerStatusHistoryService.resolveActor(user);
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
      await this.sellerStatusHistoryService.record(manager, {
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
}
