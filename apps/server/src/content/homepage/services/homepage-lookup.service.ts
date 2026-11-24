import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { ProductStatus } from '../../../database/enums/product-status.enum';
import { ProductActiveStatus } from '../../../database/enums/product-active-status.enum';
import { SellerStatus } from '../../../database/enums/seller-status.enum';
import { SellerActiveStatus } from '../../../database/enums/seller-active-status.enum';
import { EntityKind } from '../registry/section-registry';
import { isShopClosed } from '../../../shared/utils/shop-break.util';

export interface LookupEntity {
  id: number;
  name: string;
  imageUrl: string | null;
  /** False when the storefront would skip it (inactive, unapproved...). */
  eligible: boolean;
}

/** Looks up the entities a section config points at, in one query per kind. */
@Injectable()
export class HomepageLookupService {
  constructor(private readonly db: DatabaseService) {}

  async lookup(
    kind: EntityKind,
    ids: number[],
  ): Promise<Map<number, LookupEntity>> {
    const map = new Map<number, LookupEntity>();
    if (ids.length === 0) return map;

    switch (kind) {
      case 'category': {
        const rows = await this.db.category
          .createQueryBuilder('e')
          .where('e.id IN (:...ids)', { ids })
          .getMany();
        rows.forEach((r) =>
          map.set(r.id, {
            id: r.id,
            name: r.name,
            imageUrl: r.imageUrl ?? null,
            eligible: r.isActive,
          }),
        );
        break;
      }
      case 'collection': {
        const rows = await this.db.collection
          .createQueryBuilder('e')
          .where('e.id IN (:...ids)', { ids })
          .getMany();
        rows.forEach((r) =>
          map.set(r.id, {
            id: r.id,
            name: r.name,
            imageUrl: r.imageUrl ?? null,
            eligible: r.isActive,
          }),
        );
        break;
      }
      case 'banner': {
        const rows = await this.db.banner
          .createQueryBuilder('e')
          .where('e.id IN (:...ids)', { ids })
          .getMany();
        rows.forEach((r) =>
          map.set(r.id, {
            id: r.id,
            name: r.title,
            imageUrl: r.imageUrl ?? null,
            eligible: r.isActive,
          }),
        );
        break;
      }
      case 'seller': {
        const rows = await this.db.seller
          .createQueryBuilder('e')
          .where('e.id IN (:...ids)', { ids })
          .getMany();
        rows.forEach((r) =>
          map.set(r.id, {
            id: r.id,
            name: r.name,
            imageUrl: r.avatarUrl ?? null,
            eligible:
              r.status === SellerStatus.APPROVED &&
              r.activeStatus === SellerActiveStatus.ACTIVE &&
              !isShopClosed(r),
          }),
        );
        break;
      }
      case 'product': {
        const rows = await this.db.sellerProduct
          .createQueryBuilder('e')
          .leftJoinAndSelect('e.seller', 'seller')
          .where('e.id IN (:...ids)', { ids })
          .getMany();
        const withSku = await this.productIdsWithActiveSku(
          rows.map((r) => r.id),
        );
        rows.forEach((r) =>
          map.set(r.id, {
            id: r.id,
            name: r.name,
            imageUrl: r.thumbnailUrl ?? null,
            eligible:
              r.status === ProductStatus.APPROVED &&
              r.activeStatus === ProductActiveStatus.ACTIVE &&
              !!r.seller &&
              !r.seller.deletedAt &&
              r.seller.status === SellerStatus.APPROVED &&
              r.seller.activeStatus === SellerActiveStatus.ACTIVE &&
              !isShopClosed(r.seller) &&
              withSku.has(r.id),
          }),
        );
        break;
      }
    }
    return map;
  }

  private async productIdsWithActiveSku(ids: number[]): Promise<Set<number>> {
    if (ids.length === 0) return new Set();
    const rows = await this.db.sellerProductSku
      .createQueryBuilder('sku')
      .select('DISTINCT sku.sellerProductId', 'id')
      .where('sku.sellerProductId IN (:...ids)', { ids })
      .andWhere('sku.isActive = true')
      .getRawMany<{ id: number }>();
    return new Set(rows.map((r) => Number(r.id)));
  }
}
