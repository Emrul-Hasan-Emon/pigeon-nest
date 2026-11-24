import { BadRequestException, Injectable } from '@nestjs/common';
import { MAX_INT32 } from '../../../shared/constants/limits';
import { ConfigField, EntityKind, getDefinition, SectionDefinition } from '../registry/section-registry';
import { DatabaseService } from '../../../database/database.service';
import { ProductStatus } from '../../../database/enums/product-status.enum';
import { ProductActiveStatus } from '../../../database/enums/product-active-status.enum';
import { SellerStatus } from '../../../database/enums/seller-status.enum';
import { SellerActiveStatus } from '../../../database/enums/seller-active-status.enum';
import { isShopClosed, sellerOpenSql } from '../../../shared/utils/shop-break.util';
import { HomepageSection } from '../../../database/entities/homepage/homepage-section.entity';
import { HomepageDeviceVisibility } from '../../../database/enums/homepage-device-visibility.enum';
import { HomepageSectionType } from '../../../database/enums/homepage-section-type.enum';
import { SelectQueryBuilder } from 'typeorm';
import { StorefrontProductService } from '../../../storefront/storefront-product.service';
import { SellerProduct } from '../../../database/entities/product/seller-product.entity';

export interface LookupEntity {
  id: number;
  name: string;
  imageUrl: string | null;
  /** False when the storefront would skip it (inactive, unapproved...). */
  eligible: boolean;
}

export type SectionConfig = Record<string, unknown>;

export interface ConfigWarning {
  field: string;
  entityId: number;
  message: string;
}

export interface EnrichedConfig {
  config: SectionConfig;
  /** Entities the config points at, per field key. */
  entities: Record<string, LookupEntity[]>;
  warnings: ConfigWarning[];
}

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

/**
 * Everything about homepage sections that more than one role needs: checks and explains a section's config using the
 * registry, looks up the entities a config points at, and turns a section into the items the storefront shows. The admin
 * and storefront services call it.
 */
@Injectable()
export class CommonHomepageService {
  constructor(
    private readonly db: DatabaseService,
    private readonly products: StorefrontProductService,
  ) {}

  // ---- looking up the entities a section config points at ----


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

  // ---- checking and explaining a section config ----


  definitionOrThrow(type: string): SectionDefinition {
    const definition = getDefinition(type);
    if (!definition) {
      throw new BadRequestException(`Unknown sectionType "${type}"`);
    }
    return definition;
  }

  /** Throws 400 on any problem; returns the config with defaults applied. */
  async normalize(type: string, raw: unknown): Promise<SectionConfig> {
    const definition = this.definitionOrThrow(type);
    if (raw === undefined || raw === null) raw = {};
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException('config must be an object');
    }
    const input = raw as Record<string, unknown>;

    const known = new Set(definition.fields.map((f) => f.key));
    const unknown = Object.keys(input).filter((k) => !known.has(k));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `config has unknown key(s) for ${type}: ${unknown.join(', ')}`,
      );
    }

    const config: SectionConfig = {};
    for (const field of definition.fields) {
      const value = input[field.key];
      if (value === undefined || value === null) {
        if (field.required) {
          throw new BadRequestException(`config.${field.key} is required`);
        }
        if (field.default !== undefined) config[field.key] = field.default;
        continue;
      }
      config[field.key] = this.parseField(field, value);
    }

    if (definition.exactlyOne) {
      const set = definition.exactlyOne.filter(
        (key) => config[key] !== undefined,
      );
      if (set.length !== 1) {
        throw new BadRequestException(
          `config needs exactly one of: ${definition.exactlyOne.join(', ')}`,
        );
      }
    }

    await this.assertEntitiesExist(definition, config);
    return config;
  }

  /** Config plus the entities it points at, and a warning per ineligible one. */
  async enrich(type: string, config: SectionConfig): Promise<EnrichedConfig> {
    const definition = getDefinition(type);
    const entities: Record<string, LookupEntity[]> = {};
    const warnings: ConfigWarning[] = [];
    if (!definition) return { config, entities, warnings };

    for (const field of definition.fields) {
      if (!field.entity || config[field.key] === undefined) continue;
      const ids = this.idsOf(field, config);
      const found = await this.lookup(field.entity, ids);
      entities[field.key] = [];
      for (const id of ids) {
        const entity = found.get(id);
        if (!entity) {
          warnings.push({
            field: field.key,
            entityId: id,
            message: `${field.entity} ${id} no longer exists`,
          });
        } else {
          entities[field.key].push(entity);
          if (!entity.eligible) {
            warnings.push({
              field: field.key,
              entityId: id,
              message: `${field.entity} "${entity.name}" is not available on the storefront`,
            });
          }
        }
      }
    }
    return { config, entities, warnings };
  }

  idsOf(field: ConfigField, config: SectionConfig): number[] {
    const value = config[field.key];
    if (field.kind === 'int') return typeof value === 'number' ? [value] : [];
    return Array.isArray(value) ? (value as number[]) : [];
  }

  private parseField(field: ConfigField, value: unknown): unknown {
    const name = `config.${field.key}`;
    switch (field.kind) {
      case 'int':
        return this.parseInt(field, value, name);
      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new BadRequestException(`${name} must be a boolean`);
        }
        return value;
      case 'enum':
        if (
          typeof value !== 'string' ||
          !field.enumValues?.includes(value)
        ) {
          throw new BadRequestException(
            `${name} must be one of: ${field.enumValues?.join(', ')}`,
          );
        }
        return value;
      case 'intArray': {
        if (!Array.isArray(value)) {
          throw new BadRequestException(`${name} must be an array`);
        }
        const ids = value.map((v) => this.parseInt(field, v, name));
        const unique = [...new Set(ids)];
        if (field.maxItems && unique.length > field.maxItems) {
          throw new BadRequestException(
            `${name} can have at most ${field.maxItems} items`,
          );
        }
        if (unique.length === 0 && field.required) {
          throw new BadRequestException(`${name} needs at least one item`);
        }
        // an empty optional list means "not set"
        return unique.length === 0 && !field.required ? undefined : unique;
      }
    }
  }

  private parseInt(field: ConfigField, value: unknown, name: string): number {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new BadRequestException(`${name} must be an integer`);
    }
    const min = field.min ?? (field.entity ? 1 : 0);
    const max = field.max ?? MAX_INT32;
    if (value < min || value > max) {
      throw new BadRequestException(`${name} must be between ${min} and ${max}`);
    }
    return value;
  }

  private async assertEntitiesExist(
    definition: SectionDefinition,
    config: SectionConfig,
  ) {
    for (const field of definition.fields) {
      if (!field.entity || config[field.key] === undefined) continue;
      const ids = this.idsOf(field, config);
      const found = await this.lookup(field.entity as EntityKind, ids);
      const missing = ids.filter((id) => !found.has(id));
      if (missing.length > 0) {
        throw new BadRequestException(
          `config.${field.key}: ${field.entity} not found: ${missing.join(', ')}`,
        );
      }
    }
  }

  // ---- turning a section into the items the storefront shows ----


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
