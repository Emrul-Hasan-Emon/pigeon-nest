import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { SellerActiveStatus } from '../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../database/enums/seller-status.enum';
import { likeContains } from '../../shared/utils/like.util';
import { PageRequest, pageResult } from '../../shared/utils/page-paginate.util';
import { StorefrontProductService } from '../storefront-product.service';
import { sellerOpenSql } from '../../shared/utils/shop-break.util';

export enum SellerSort {
  NEWEST = 'newest',
  NAME_ASC = 'nameAsc',
}

// A seller worth listing: approved, active, and with something to buy.
const HAS_PRODUCT = `EXISTS (
  SELECT 1 FROM seller_product p
  WHERE p."sellerId" = s.id AND p.status = 'approved' AND p."activeStatus" = 'active'
    AND p."deletedAt" IS NULL
    AND EXISTS (SELECT 1 FROM seller_product_sku k WHERE k."sellerProductId" = p.id AND k."isActive" = true AND k."deletedAt" IS NULL))`;

@Injectable()
export class StorefrontSellerService {
  constructor(
    private readonly db: DatabaseService,
    private readonly products: StorefrontProductService,
  ) {}

  private visible() {
    return this.db.seller
      .createQueryBuilder('s')
      .where('s.status = :st', { st: SellerStatus.APPROVED })
      .andWhere('s.activeStatus = :ac', { ac: SellerActiveStatus.ACTIVE })
      // A seller who is not selling right now is not shown anywhere: not the page, not the list, not their products.
      .andWhere(sellerOpenSql('s'));
  }

  async list(search: string | undefined, sort: SellerSort | undefined, page: PageRequest) {
    const qb = this.visible().andWhere(HAS_PRODUCT);
    if (search) qb.andWhere('s.name ILIKE :q', { q: likeContains(search) });
    if (sort === SellerSort.NAME_ASC) qb.orderBy('LOWER(s.name)', 'ASC').addOrderBy('s.id', 'ASC');
    else qb.orderBy('s.id', 'DESC');

    const [rows, total] = await qb.skip(page.offset).take(page.pageSize).getManyAndCount();
    const counts = await this.products.countBySeller(rows.map((r) => r.id));
    return pageResult(
      rows.map((s) => this.view(s, counts.get(s.id) ?? 0)),
      total,
      page,
    );
  }

  async details(id: number) {
    const seller = await this.visible().andWhere('s.id = :id', { id }).getOne();
    if (!seller) throw new NotFoundException('Seller not found');
    const counts = await this.products.countBySeller([id]);
    return { ...this.view(seller, counts.get(id) ?? 0), description: seller.description ?? null, ...(await this.rating(id)) };
  }

  // The shop's rating over every published review of its products.
  private async rating(sellerId: number) {
    const rows: { rating: number; n: number }[] = await this.db.seller.manager.query(
      `SELECT r.rating, COUNT(*)::int AS n FROM review r JOIN seller_product p ON p.id = r."sellerProductId"
        WHERE p."sellerId" = $1 AND r.status = 'published' AND r."deletedAt" IS NULL GROUP BY r.rating`,
      [sellerId],
    );
    const breakdown: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    let ratingCount = 0;
    let sum = 0;
    for (const r of rows) {
      breakdown[String(r.rating)] = r.n;
      ratingCount += r.n;
      sum += r.n * r.rating;
    }
    return { ratingCount, ratingAverage: ratingCount === 0 ? 0 : Math.round((sum / ratingCount) * 100) / 100, breakdown };
  }

  // Public view: never email, phone, ID images, commission or payout details.
  private view(s: { id: number; name: string; avatarUrl: string | null; createdAt: Date }, productCount: number) {
    return {
      id: s.id,
      name: s.name,
      avatarUrl: s.avatarUrl ?? null,
      joinedAt: s.createdAt,
      productCount,
    };
  }
}
