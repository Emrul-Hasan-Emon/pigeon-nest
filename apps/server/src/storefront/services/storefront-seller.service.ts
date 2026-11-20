import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { SellerActiveStatus } from '../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../database/enums/seller-status.enum';
import { likeContains } from '../../shared/utils/like.util';
import { PageRequest, pageResult } from '../../shared/utils/page-paginate.util';
import { StorefrontProductService } from '../storefront-product.service';

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
      .andWhere('s.activeStatus = :ac', { ac: SellerActiveStatus.ACTIVE });
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
    return this.view(seller, counts.get(id) ?? 0);
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
