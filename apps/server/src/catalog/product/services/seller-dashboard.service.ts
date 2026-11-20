import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { Seller } from '../../../database/entities/seller/seller.entity';
import { ProductActiveStatus } from '../../../database/enums/product-active-status.enum';
import { ProductStatus } from '../../../database/enums/product-status.enum';

// Numbers for the seller's landing page. Deleted products are not counted.
@Injectable()
export class SellerDashboardService {
  constructor(private readonly databaseService: DatabaseService) {}

  async summary(seller: Seller) {
    const rows = await this.databaseService.sellerProduct
      .createQueryBuilder('product')
      .select('product.status', 'status')
      .addSelect('product.activeStatus', 'activeStatus')
      .addSelect('COUNT(*)', 'count')
      .where('product.sellerId = :sellerId', { sellerId: seller.id })
      .groupBy('product.status')
      .addGroupBy('product.activeStatus')
      .getRawMany<{
        status: ProductStatus;
        activeStatus: ProductActiveStatus;
        count: string;
      }>();

    const status = { approved: 0, pending: 0, rejected: 0 };
    const activeStatus = { active: 0, inactive: 0, suspended: 0 };
    let total = 0;
    let visible = 0;
    let frozen = 0;
    for (const row of rows) {
      const count = Number(row.count);
      total += count;
      status[row.status] += count;
      activeStatus[row.activeStatus] += count;
      if (
        row.status === ProductStatus.APPROVED &&
        row.activeStatus === ProductActiveStatus.ACTIVE
      ) {
        visible += count;
      }
      if (
        row.status === ProductStatus.REJECTED ||
        row.activeStatus === ProductActiveStatus.SUSPENDED
      ) {
        frozen += count;
      }
    }

    const skuRow = await this.databaseService.sellerProductSku
      .createQueryBuilder('sku')
      .innerJoin('sku.product', 'product')
      .select('COUNT(*)', 'total')
      .addSelect(
        'COALESCE(SUM(CASE WHEN sku.quantity <= 0 THEN 1 ELSE 0 END), 0)',
        'outOfStock',
      )
      .where('product.sellerId = :sellerId', { sellerId: seller.id })
      .getRawOne<{ total: string; outOfStock: string }>();

    return {
      totalProducts: total,
      status,
      activeStatus,
      // Shown on the storefront: approved AND active.
      visibleProducts: visible,
      // Rejected or suspended by an admin: the seller cannot change them.
      lockedProducts: frozen,
      totalSkus: Number(skuRow?.total ?? 0),
      outOfStockSkus: Number(skuRow?.outOfStock ?? 0),
    };
  }
}
