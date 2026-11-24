import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { HomepageSection } from '../../../database/entities/homepage/homepage-section.entity';
import { HomepageDeviceVisibility } from '../../../database/enums/homepage-device-visibility.enum';
import { HomepageSectionType } from '../../../database/enums/homepage-section-type.enum';
import { SellerActiveStatus } from '../../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../../database/enums/seller-status.enum';
import { SectionConfig } from './homepage-config.service';
import { SelectQueryBuilder } from 'typeorm';
import { StorefrontProductService } from '../../../storefront/storefront-product.service';
import { SellerProduct } from '../../../database/entities/product/seller-product.entity';
import { sellerOpenSql } from '../../../shared/utils/shop-break.util';

export type Device = 'mobile' | 'web';

export interface ResolvedSection {
  id: number;
  title: string;
  sectionType: string;
  layout: string;
  slotNo: number | null;
  items: Record<string, unknown>[];
  /** Where a "See all" button should lead; null when the section has no list page. */
  seeAll: SeeAllTarget | null;
}

export type SeeAllTarget =
  | { type: 'category'; slug: string }
  | { type: 'collection'; slug: string }
  | { type: 'featured' }
  | { type: 'products' }
  | { type: 'collections' }
  | { type: 'sellers' };

const num = (value: unknown, fallback: number) =>
  typeof value === 'number' ? value : fallback;

/** Turns a section's config into the items the storefront shows. */
@Injectable()
export class HomepageResolverService {
  constructor(
    private readonly db: DatabaseService,
    private readonly products: StorefrontProductService,
  ) {}

  /** True when the section may be shown right now on this device. */
  isVisible(section: HomepageSection, device: Device, now = new Date()) {
    if (!section.isActive) return false;
    if (section.startsAt && section.startsAt > now) return false;
    if (section.endsAt && section.endsAt <= now) return false;
    return (
      section.deviceVisibility === HomepageDeviceVisibility.BOTH ||
      (section.deviceVisibility as string) === device
    );
  }

  async resolve(
    section: HomepageSection,
    device: Device,
  ): Promise<ResolvedSection> {
    return {
      id: section.id,
      title: section.title,
      sectionType: section.sectionType,
      layout: section.layout,
      slotNo: section.slotNo,
      items: await this.items(section, device),
      seeAll: await this.seeAll(section),
    };
  }

  private async seeAll(section: HomepageSection): Promise<SeeAllTarget | null> {
    const config = (section.config ?? {}) as SectionConfig;
    switch (section.sectionType as HomepageSectionType) {
      case HomepageSectionType.CATEGORY_PRODUCTS: {
        const category = await this.db.category.findOne({
          where: { id: config.categoryId as number },
        });
        return category?.isActive ? { type: 'category', slug: category.slug } : { type: 'products' };
      }
      case HomepageSectionType.COLLECTION_PRODUCTS: {
        const collection = await this.db.collection.findOne({
          where: { id: config.collectionId as number },
        });
        return collection?.isActive ? { type: 'collection', slug: collection.slug } : { type: 'products' };
      }
      case HomepageSectionType.FEATURED_PRODUCTS:
        return { type: 'featured' };
      case HomepageSectionType.SPECIFIC_COLLECTIONS:
        return { type: 'collections' };
      case HomepageSectionType.SELLERS:
        return { type: 'sellers' };
      case HomepageSectionType.CATEGORIES:
      case HomepageSectionType.SPECIFIC_PRODUCTS:
        return { type: 'products' };
      default:
        return null; // banners
    }
  }

  async items(section: HomepageSection, device: Device) {
    const config = (section.config ?? {}) as SectionConfig;
    const limit = num(config.limit, 10);

    switch (section.sectionType as HomepageSectionType) {
      case HomepageSectionType.BANNERS:
        return this.banners(config, device, limit);
      case HomepageSectionType.CATEGORIES:
        return this.categories(config, limit);
      case HomepageSectionType.CATEGORY_PRODUCTS:
        return this.categoryProducts(config, limit);
      case HomepageSectionType.COLLECTION_PRODUCTS:
        return this.productCards(
          this.eligibleProducts().andWhere('p.collectionId = :id', {
            id: config.collectionId,
          }),
          limit,
        );
      case HomepageSectionType.SPECIFIC_PRODUCTS:
        return this.specificProducts(config);
      case HomepageSectionType.SPECIFIC_COLLECTIONS:
        return this.specificCollections(config);
      case HomepageSectionType.FEATURED_PRODUCTS:
        return this.productCards(
          this.eligibleProducts().andWhere('p.isFeatured = true'),
          limit,
        );
      case HomepageSectionType.SELLERS:
        return this.sellers(config, limit);
      default:
        return [];
    }
  }

  private async banners(config: SectionConfig, device: Device, limit: number) {
    const qb = this.db.banner
      .createQueryBuilder('b')
      .where('b.isActive = true')
      .andWhere('(b.startsAt IS NULL OR b.startsAt <= now())')
      .andWhere('(b.endsAt IS NULL OR b.endsAt > now())');
    const ids = config.bannerIds as number[] | undefined;
    if (ids?.length) {
      qb.andWhere('b.id IN (:...ids)', { ids });
    } else {
      qb.andWhere('b.position = :position', { position: config.position })
        .orderBy('b.sortOrder', 'ASC')
        .addOrderBy('b.id', 'ASC')
        .take(limit);
    }
    const rows = await qb.getMany();
    const ordered = ids?.length ? this.byIds(rows, ids) : rows;
    return ordered.map((b) => ({
      id: b.id,
      title: b.title,
      imageUrl:
        device === 'mobile' && b.mobileImageUrl ? b.mobileImageUrl : b.imageUrl,
      linkUrl: b.linkUrl ?? null,
      position: b.position,
    }));
  }

  private async categories(config: SectionConfig, limit: number) {
    const ids = config.categoryIds as number[] | undefined;
    const qb = this.db.category.createQueryBuilder('c').where('c.isActive = true');
    if (ids?.length) {
      qb.andWhere('c.id IN (:...ids)', { ids });
    } else {
      qb.andWhere('c.parentId IS NULL')
        .orderBy('c.sortOrder', 'ASC')
        .addOrderBy('c.id', 'ASC')
        .take(limit);
    }
    const rows = await qb.getMany();
    return (ids?.length ? this.byIds(rows, ids) : rows).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      imageUrl: c.imageUrl ?? null,
    }));
  }

  private async specificCollections(config: SectionConfig) {
    const ids = (config.collectionIds as number[]) ?? [];
    if (ids.length === 0) return [];
    const rows = await this.db.collection
      .createQueryBuilder('c')
      .where('c.isActive = true')
      .andWhere('c.id IN (:...ids)', { ids })
      .getMany();
    return this.byIds(rows, ids).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      imageUrl: c.imageUrl ?? null,
      colorCode: c.colorCode ?? null,
    }));
  }

  private async sellers(config: SectionConfig, limit: number) {
    const ids = config.sellerIds as number[] | undefined;
    const qb = this.db.seller
      .createQueryBuilder('s')
      .where('s.status = :status', { status: SellerStatus.APPROVED })
      .andWhere('s.activeStatus = :active', {
        active: SellerActiveStatus.ACTIVE,
      })
      .andWhere(sellerOpenSql('s'));
    if (ids?.length) {
      qb.andWhere('s.id IN (:...ids)', { ids });
    } else {
      qb.orderBy('s.id', 'DESC').take(limit);
    }
    const rows = await qb.getMany();
    return (ids?.length ? this.byIds(rows, ids) : rows).map((s) => ({
      id: s.id,
      name: s.name,
      avatarUrl: s.avatarUrl ?? null,
    }));
  }

  private async categoryProducts(config: SectionConfig, limit: number) {
    const categoryId = config.categoryId as number;
    const category = await this.db.category.findOne({
      where: { id: categoryId },
    });
    if (!category || !category.isActive) return [];

    const categoryIds =
      config.includeSubcategories !== false
        ? await this.products.categoryTreeIds(categoryId)
        : [categoryId];
    return this.productCards(
      this.eligibleProducts().andWhere('p.categoryId IN (:...categoryIds)', {
        categoryIds,
      }),
      limit,
    );
  }

  private async specificProducts(config: SectionConfig) {
    const ids = (config.productIds as number[]) ?? [];
    if (ids.length === 0) return [];
    const cards = await this.productCards(
      this.eligibleProducts().andWhere('p.id IN (:...ids)', { ids }),
      ids.length,
    );
    return this.byIds(cards as { id: number }[], ids);
  }

  private eligibleProducts() {
    return this.products.eligibleProducts();
  }

  private async productCards(
    qb: SelectQueryBuilder<SellerProduct>,
    limit: number,
  ) {
    const rows = await qb.orderBy('p.id', 'DESC').take(limit).getMany();
    return this.products.toCards(rows);
  }

  private byIds<T extends { id: number }>(rows: T[], ids: number[]): T[] {
    const map = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => map.get(id)).filter((r): r is T => !!r);
  }
}
