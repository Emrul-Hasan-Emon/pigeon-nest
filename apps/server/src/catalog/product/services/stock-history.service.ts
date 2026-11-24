import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { AuthUserType } from '../../../database/enums/auth-user-type.enum';
import { CursorPagination } from '../../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../../shared/utils/cursor-paginate.util';
import { maskName } from '../../../shared/utils/mask-name.util';

/** The stock log of one product: every change to the stock of any of its options, newest first. */
@Injectable()
export class StockHistoryService {
  constructor(private readonly db: DatabaseService) {}

  /** `sellerId` limits it to one seller's own product (a seller); leave it out for an admin. */
  async listForProduct(productId: number, pagination: CursorPagination, sellerId?: number) {
    const product = await this.db.sellerProduct.findOne({
      where: { id: productId, ...(sellerId !== undefined ? { sellerId } : {}) },
      select: { id: true },
      withDeleted: true,
    });
    if (!product) throw new NotFoundException('Product not found');

    const qb = this.db.stockMovement
      .createQueryBuilder('m')
      .where('m.sellerProductId = :productId', { productId })
      .orderBy('m.id', 'DESC')
      .take(pagination.limit);
    if (pagination.cursor > 0) qb.andWhere('m.id < :cursor', { cursor: pagination.cursor });
    const rows = await qb.getMany();
    const results = rows.map((m) => ({
      id: m.id,
      sku: { id: m.sellerProductSkuId, label: m.skuLabel },
      change: m.change,
      quantityAfter: m.quantityAfter,
      reason: m.reason,
      orderId: m.orderId,
      note: m.note,
      // A customer's name is masked, like everywhere else a seller reads one.
      by: m.creatorType === AuthUserType.USER ? maskName(m.creatorName) : m.creatorType === AuthUserType.ADMIN ? 'Admin team' : m.creatorName,
      createdAt: m.createdAt,
    }));
    return getCursorPaginateData(results, pagination.limit);
  }
}
