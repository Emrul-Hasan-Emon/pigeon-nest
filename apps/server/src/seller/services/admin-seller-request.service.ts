import { ConflictException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Seller } from '../../database/entities/seller/seller.entity';
import { SellerActiveStatus } from '../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../database/enums/seller-status.enum';
import { ListSellerRequestQueryDto } from '../dtos/list-seller-request-query.dto';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import { CommonSellerService } from './common-seller.service';

@Injectable()
export class AdminSellerRequestService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly commonSellerService: CommonSellerService,
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
  async approve(id: number) {
    const seller = await this.getDecidable(id, 'approved');
    await this.databaseService.seller.update(seller.id, {
      status: SellerStatus.APPROVED,
      activeStatus: SellerActiveStatus.ACTIVE,
      rejectionReason: null,
    });
    return this.reload(id);
  }

  // rejected + inactive, with an optional reason the seller can read
  async reject(id: number, reason?: string) {
    const seller = await this.getDecidable(id, 'rejected');
    await this.databaseService.seller.update(seller.id, {
      status: SellerStatus.REJECTED,
      activeStatus: SellerActiveStatus.INACTIVE,
      rejectionReason: reason ?? null,
    });
    return this.reload(id);
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
