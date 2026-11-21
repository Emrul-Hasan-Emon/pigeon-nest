import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  ILike,
  In,
  Not,
  QueryFailedError,
} from 'typeorm';
import { DatabaseService } from '../../../database/database.service';
import { FileUploadService } from '../../../file-management/file-upload.service';
import { FileInfo } from '../../../file-management/types/file-info.type';
import { SellerProduct } from '../../../database/entities/product/seller-product.entity';
import { SellerProductSku } from '../../../database/entities/product/seller-product-sku.entity';
import { SellerProductSkuVariant } from '../../../database/entities/product/seller-product-sku-variant.entity';
import { SellerProductMedia } from '../../../database/entities/product-media/seller-product-media.entity';
import { Seller } from '../../../database/entities/seller/seller.entity';
import { SellerStatus } from '../../../database/enums/seller-status.enum';
import { SellerActiveStatus } from '../../../database/enums/seller-active-status.enum';
import { ProductStatus } from '../../../database/enums/product-status.enum';
import { ProductActiveStatus } from '../../../database/enums/product-active-status.enum';
import { ProductStatusChangeAction } from '../../../database/enums/product-status-change-action.enum';
import { AuthUserType } from '../../../database/enums/auth-user-type.enum';
import { Actor } from '../../../shared/types/actor.type';
import { ProductStatusHistoryService } from './product-status-history.service';
import { MediaType } from '../../../database/enums/media-type.enum';
import { CreateProductDto } from '../dtos/create-product.dto';
import { UpdateProductDto } from '../dtos/update-product.dto';
import { ListProductQueryDto, ProductListSort } from '../dtos/list-product-query.dto';
import { CreateProductSkuDto } from '../dtos/create-product-sku.dto';
import { UpdateProductSkuDto } from '../dtos/update-product-sku.dto';
import { SkuVariantPairDto } from '../dtos/sku-variant-pair.dto';
import { UpdateProductMediaFilesDto } from '../dtos/update-product-media-files.dto';
import { slugify } from '../../../shared/utils/slugify.util';
import { likeContains } from '../../../shared/utils/like.util';
import { assertUploadAllowed } from '../../../shared/utils/upload-validation.util';
import { CursorPagination } from '../../../shared/decorators/cursor-pagination-params.decorator';
import { getCursorPaginateData } from '../../../shared/utils/cursor-paginate.util';

const MEDIA_FOLDER = 'products/media';
const THUMBNAIL_FOLDER = 'products';
const THUMBNAIL_MAX_BYTES = 10 * 1024 * 1024;

export interface ProductMediaFiles {
  thumbnailImage?: Express.Multer.File;
  mediaFiles?: Express.Multer.File[];
}

// Set when the caller is a seller: limits every call to that seller's own
// products and applies the status locks.
export interface SellerScope {
  sellerId: number;
}

interface SkuChangePlan {
  removeIds: number[];
  updates: Array<{ existing: SellerProductSku; dto: UpdateProductSkuDto }>;
  creates: CreateProductSkuDto[];
}

@Injectable()
export class AdminProductService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly fileUploadService: FileUploadService,
    private readonly historyService: ProductStatusHistoryService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async list(
    query: ListProductQueryDto,
    pagination: CursorPagination,
    scope?: SellerScope,
  ) {
    const qb = this.databaseService.sellerProduct
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.seller', 'seller')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.collection', 'collection')
      .take(pagination.limit);
    const mostSaved = query.sort === ProductListSort.MOST_SAVED;
    if (mostSaved) {
      qb.orderBy('product.wishlistCount', 'DESC').addOrderBy('product.id', 'DESC').skip(pagination.cursor);
    } else {
      qb.orderBy('product.id', 'DESC');
    }

    if (query.search) {
      qb.andWhere('product.name ILIKE :search', {
        search: likeContains(query.search),
      });
    }
    if (query.sellerSearch) {
      qb.andWhere(
        '(seller.name ILIKE :sellerSearch OR seller.email ILIKE :sellerSearch OR seller.phone ILIKE :sellerSearch)',
        { sellerSearch: likeContains(query.sellerSearch) },
      );
    }
    const sellerId = scope ? scope.sellerId : query.sellerId;
    if (sellerId !== undefined) {
      qb.andWhere('product.sellerId = :sellerId', { sellerId });
    }
    if (query.categoryId !== undefined) {
      qb.andWhere('product.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.collectionId !== undefined) {
      qb.andWhere('product.collectionId = :collectionId', {
        collectionId: query.collectionId,
      });
    }
    if (query.status !== undefined) {
      qb.andWhere('product.status = :status', { status: query.status });
    }
    if (query.activeStatus !== undefined) {
      qb.andWhere('product.activeStatus = :activeStatus', {
        activeStatus: query.activeStatus,
      });
    }
    if (query.isFeatured !== undefined) {
      qb.andWhere('product.isFeatured = :isFeatured', {
        isFeatured: query.isFeatured,
      });
    }
    if (!mostSaved && pagination.cursor > 0) {
      qb.andWhere('product.id < :cursor', { cursor: pagination.cursor });
    }

    const results = await qb.getMany();
    if (mostSaved) {
      // Offset paging: the next cursor is how many rows have been served.
      const size = pagination.limit - 1;
      return {
        results: results.slice(0, size).map((product) => this.toResponse(product)),
        nextCursor: results.length > size ? pagination.cursor + size : null,
      };
    }
    const page = getCursorPaginateData(results, pagination.limit);
    return {
      ...page,
      results: page.results.map((product) => this.toResponse(product)),
    };
  }

  async details(id: number, scope?: SellerScope) {
    return this.toResponse(await this.findOrThrow(id, scope));
  }

  async create(dto: CreateProductDto, actor: Actor) {
    const isSeller = actor.type === AuthUserType.SELLER;
    const status = isSeller
      ? ProductStatus.APPROVED
      : (dto.status ?? ProductStatus.APPROVED);
    const activeStatus = dto.activeStatus ?? ProductActiveStatus.ACTIVE;
    if (
      isSeller &&
      (dto.status !== undefined ||
        activeStatus === ProductActiveStatus.SUSPENDED)
    ) {
      throw new ForbiddenException(
        'Only an admin can set status or suspend a product',
      );
    }
    if (
      (status === ProductStatus.REJECTED ||
        activeStatus === ProductActiveStatus.SUSPENDED) &&
      !dto.reason
    ) {
      throw new BadRequestException(
        'A reason is required when rejecting or suspending a product',
      );
    }

    await this.assertSellerIsEligible(dto.sellerId);
    await this.assertCategoryExists(dto.categoryId);
    if (dto.collectionId != null) {
      await this.assertCollectionExists(dto.collectionId);
    }

    const slug = this.buildSlug(dto.name);
    await this.assertSlugIsUnique(dto.sellerId, slug);

    for (const sku of dto.skus) {
      await this.assertVariantsAreValid(sku.variants);
      this.assertDiscountIsValid(
        sku.price,
        sku.discountedPrice,
        sku.discountedPriceStartDate,
        sku.discountedPriceEndDate,
      );
    }
    if (dto.skus.filter((sku) => sku.isDefault).length > 1) {
      throw new BadRequestException('Only one SKU can be the default');
    }
    this.assertNoDuplicateCombos(dto.skus.map((sku) => sku.variants));
    const defaultIndex = Math.max(
      dto.skus.findIndex((sku) => sku.isDefault),
      0,
    );

    const productId = await this.runTransaction(async (manager) => {
      const product = await manager.save(
        manager.create(SellerProduct, {
          sellerId: dto.sellerId,
          categoryId: dto.categoryId,
          collectionId: dto.collectionId ?? null,
          name: dto.name,
          slug,
          description: dto.description,
          isFeatured: dto.isFeatured ?? false,
          status,
          activeStatus,
          rejectionReason:
            status === ProductStatus.REJECTED ? dto.reason : null,
          suspensionReason:
            activeStatus === ProductActiveStatus.SUSPENDED ? dto.reason : null,
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
        }),
      );

      for (const [index, sku] of dto.skus.entries()) {
        await this.insertSku(manager, product.id, sku, index === defaultIndex);
      }
      await this.historyService.record(manager, {
        sellerProductId: product.id,
        fromStatus: null,
        fromActiveStatus: null,
        toStatus: status,
        toActiveStatus: activeStatus,
        action: isSeller
          ? ProductStatusChangeAction.SELLER_CREATED
          : ProductStatusChangeAction.ADMIN_CREATED,
        reason: dto.reason,
        actor,
      });
      return product.id;
    });

    return this.details(productId);
  }

  async update(
    id: number,
    dto: UpdateProductDto,
    actor: Actor,
    scope?: SellerScope,
  ) {
    const product = await this.loadScoped(id, scope);
    if (scope) {
      this.assertSellerCanTouch(product);
    }

    const patch: Record<string, unknown> = {};
    if (dto.categoryId !== undefined) {
      await this.assertCategoryExists(dto.categoryId);
      patch.categoryId = dto.categoryId;
    }
    if (dto.collectionId !== undefined) {
      if (dto.collectionId !== null) {
        await this.assertCollectionExists(dto.collectionId);
      }
      patch.collectionId = dto.collectionId;
    }
    if (dto.name !== undefined && dto.name !== product.name) {
      const slug = this.buildSlug(dto.name);
      await this.assertSlugIsUnique(product.sellerId, slug, id);
      patch.name = dto.name;
      patch.slug = slug;
    }
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.isFeatured !== undefined) patch.isFeatured = dto.isFeatured;
    if (dto.seoTitle !== undefined) patch.seoTitle = dto.seoTitle;
    if (dto.seoDescription !== undefined) {
      patch.seoDescription = dto.seoDescription;
    }

    const plan =
      dto.skus !== undefined || dto.removeSkuIds !== undefined
        ? await this.planSkuChanges(id, dto.skus ?? [], dto.removeSkuIds ?? [])
        : null;

    await this.runTransaction(async (manager) => {
      // Lock the row so a concurrent admin decision (reject / suspend) cannot
      // slip in between the seller's permission check and the write.
      const locked = await manager.findOne(SellerProduct, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException('Product not found');
      }
      if (scope) {
        this.assertSellerCanTouch(locked);
      }
      const change = this.resolveStatusChange(locked, dto, actor);
      Object.assign(patch, change?.patch);

      if (Object.keys(patch).length > 0) {
        await manager.update(SellerProduct, id, patch);
      }
      if (plan) {
        await this.applySkuChanges(manager, id, plan);
      }
      if (change) {
        await this.historyService.record(manager, {
          sellerProductId: id,
          fromStatus: locked.status,
          fromActiveStatus: locked.activeStatus,
          toStatus: change.toStatus,
          toActiveStatus: change.toActiveStatus,
          action:
            actor.type === AuthUserType.SELLER
              ? ProductStatusChangeAction.SELLER_UPDATED
              : ProductStatusChangeAction.ADMIN_UPDATED,
          reason: dto.reason,
          actor,
        });
      }
    });

    return this.details(id, scope);
  }

  async remove(id: number, scope?: SellerScope) {
    const product = await this.loadScoped(id, scope);
    if (scope) {
      this.assertSellerCanTouch(product);
    }
    await this.dataSource.transaction(async (manager) => {
      if (scope) {
        const locked = await manager.findOne(SellerProduct, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked) {
          throw new NotFoundException('Product not found');
        }
        this.assertSellerCanTouch(locked);
      }
      // Free the slug so the seller can reuse the name; the DB unique
      // constraint on (sellerId, slug) also covers soft-deleted rows.
      await manager.update(SellerProduct, id, {
        slug: `${product.slug}-deleted-${id}`,
      });
      await manager.softDelete(SellerProduct, { id });
    });
    return { deleted: true };
  }

  // Thumbnail + gallery in one call: replace/remove the thumbnail, add new
  // gallery files, remove gallery files by id.
  async updateMediaFiles(
    id: number,
    dto: UpdateProductMediaFilesDto,
    files: ProductMediaFiles,
    scope?: SellerScope,
  ) {
    const product = await this.loadScoped(id, scope);
    if (scope) {
      this.assertSellerCanTouch(product);
    }

    const newThumbnail = files.thumbnailImage;
    const newMedia = files.mediaFiles ?? [];
    const removeIds = [...new Set(dto.removeMediaFilesIds ?? [])];

    if (
      !newThumbnail &&
      !dto.removeThumbnail &&
      newMedia.length === 0 &&
      removeIds.length === 0
    ) {
      throw new BadRequestException(
        'Provide thumbnailImage, removeThumbnail, mediaFiles or removeMediaFilesIds',
      );
    }
    if (newThumbnail && dto.removeThumbnail) {
      throw new BadRequestException(
        'thumbnailImage and removeThumbnail cannot be used together',
      );
    }

    if (newThumbnail) {
      assertUploadAllowed(newThumbnail, ['image']);
      if (newThumbnail.size > THUMBNAIL_MAX_BYTES) {
        throw new PayloadTooLargeException('Thumbnail must be 10MB or smaller');
      }
    }
    for (const file of newMedia) {
      assertUploadAllowed(file, ['image', 'video']);
    }

    const toRemove = removeIds.length
      ? await this.databaseService.sellerProductMedia.find({
          where: { id: In(removeIds), sellerProductId: id },
        })
      : [];
    if (toRemove.length !== removeIds.length) {
      throw new NotFoundException(
        'Some removeMediaFilesIds do not belong to this product',
      );
    }

    const uploaded: FileInfo[] = [];
    try {
      let thumbnail: FileInfo | undefined;
      if (newThumbnail) {
        thumbnail = await this.fileUploadService.uploadFile(
          newThumbnail,
          THUMBNAIL_FOLDER,
        );
        uploaded.push(thumbnail);
      }

      const mediaInfos: Array<{ info: FileInfo; type: MediaType }> = [];
      for (const file of newMedia) {
        const info = await this.fileUploadService.uploadFile(
          file,
          MEDIA_FOLDER,
        );
        uploaded.push(info);
        mediaInfos.push({
          info,
          type: file.mimetype.startsWith('video/')
            ? MediaType.VIDEO
            : MediaType.IMAGE,
        });
      }

      const maxRow = await this.databaseService.sellerProductMedia
        .createQueryBuilder('media')
        .select('MAX(media.sortOrder)', 'max')
        .where('media.sellerProductId = :id', { id })
        .getRawOne<{ max: number | null }>();
      let sortOrder = (maxRow?.max ?? -1) + 1;

      await this.runTransaction(async (manager) => {
        if (scope) {
          const locked = await manager.findOne(SellerProduct, {
            where: { id },
            lock: { mode: 'pessimistic_write' },
          });
          if (!locked) {
            throw new NotFoundException('Product not found');
          }
          this.assertSellerCanTouch(locked);
        }
        if (thumbnail) {
          await manager.update(SellerProduct, id, {
            thumbnailUrl: thumbnail.fileUrl,
            thumbnailPath: thumbnail.filePath,
          });
        } else if (dto.removeThumbnail) {
          const clear: Record<string, unknown> = {
            thumbnailUrl: null,
            thumbnailPath: null,
          };
          await manager.update(SellerProduct, id, clear);
        }
        if (toRemove.length > 0) {
          await manager.softRemove(toRemove);
        }
        for (const { info, type } of mediaInfos) {
          await manager.save(
            manager.create(SellerProductMedia, {
              sellerProductId: id,
              url: info.fileUrl,
              path: info.filePath,
              type,
              isPrimary: false,
              sortOrder: sortOrder++,
            }),
          );
        }
      });

      const stalePaths = toRemove.map((media) => media.path);
      if ((thumbnail || dto.removeThumbnail) && product.thumbnailPath) {
        stalePaths.push(product.thumbnailPath);
      }
      for (const path of stalePaths) {
        await this.fileUploadService.removeFile(path).catch(() => undefined);
      }
    } catch (error) {
      await this.fileUploadService.removeFiles(uploaded).catch(() => undefined);
      throw error;
    }

    return this.details(id, scope);
  }

  // ---- SKU helpers ----

  private async insertSku(
    manager: EntityManager,
    productId: number,
    dto: CreateProductSkuDto,
    isDefault: boolean,
  ) {
    const {
      variants,
      discountedPriceStartDate,
      discountedPriceEndDate,
      ...rest
    } = dto;
    const saved = await manager.save(
      manager.create(SellerProductSku, {
        ...rest,
        sellerProductId: productId,
        discountedPrice: dto.discountedPrice ?? dto.price,
        discountedPriceStartDate: discountedPriceStartDate
          ? new Date(discountedPriceStartDate)
          : null,
        discountedPriceEndDate: discountedPriceEndDate
          ? new Date(discountedPriceEndDate)
          : null,
        isDefault,
        isActive: dto.isActive ?? true,
      }),
    );

    for (const pair of variants) {
      await manager.save(
        manager.create(SellerProductSkuVariant, {
          sellerProductId: productId,
          sellerProductSkuId: saved.id,
          attributeId: pair.attributeId,
          attributeValueId: pair.attributeValueId,
        }),
      );
    }
    return saved;
  }

  private async planSkuChanges(
    productId: number,
    items: UpdateProductSkuDto[],
    removeSkuIds: number[],
  ): Promise<SkuChangePlan> {
    const existing = await this.databaseService.sellerProductSku.find({
      where: { sellerProductId: productId },
      relations: { variants: true },
    });
    const byId = new Map(existing.map((sku) => [sku.id, sku]));
    const removeSet = new Set(removeSkuIds);

    for (const skuId of removeSet) {
      if (!byId.has(skuId)) {
        throw new BadRequestException(
          `SKU ${skuId} does not belong to this product`,
        );
      }
    }

    const updates: SkuChangePlan['updates'] = [];
    const creates: CreateProductSkuDto[] = [];
    const seen = new Set<number>();

    for (const item of items) {
      if (item.id !== undefined) {
        const current = byId.get(item.id);
        if (!current) {
          throw new BadRequestException(
            `SKU ${item.id} does not belong to this product`,
          );
        }
        if (removeSet.has(item.id)) {
          throw new BadRequestException(
            `SKU ${item.id} cannot be updated and removed in the same request`,
          );
        }
        if (seen.has(item.id)) {
          throw new BadRequestException(`Duplicate SKU id in skus: ${item.id}`);
        }
        seen.add(item.id);
        if (item.variants !== undefined) {
          throw new BadRequestException(
            'SKU variants cannot be changed; remove the SKU and add a new one',
          );
        }
        if (item.sku !== undefined) {
          throw new BadRequestException('SKU code cannot be changed');
        }
        this.assertDiscountIsValid(
          item.price ?? current.price,
          item.discountedPrice ?? current.discountedPrice ?? undefined,
          item.discountedPriceStartDate ??
            current.discountedPriceStartDate?.toISOString(),
          item.discountedPriceEndDate ??
            current.discountedPriceEndDate?.toISOString(),
        );
        updates.push({ existing: current, dto: item });
      } else {
        if (item.price === undefined) {
          throw new BadRequestException('price is required for a new SKU');
        }
        if (!item.variants || item.variants.length === 0) {
          throw new BadRequestException('variants are required for a new SKU');
        }
        await this.assertVariantsAreValid(item.variants);
        this.assertDiscountIsValid(
          item.price,
          item.discountedPrice,
          item.discountedPriceStartDate,
          item.discountedPriceEndDate,
        );
        creates.push({
          ...item,
          price: item.price,
          variants: item.variants,
        });
      }
    }

    if (items.filter((item) => item.isDefault === true).length > 1) {
      throw new BadRequestException('Only one SKU can be the default');
    }
    const keptCombos = existing
      .filter((sku) => !removeSet.has(sku.id))
      .map((sku) => sku.variants);
    this.assertNoDuplicateCombos([
      ...keptCombos,
      ...creates.map((sku) => sku.variants),
    ]);
    if (existing.length - removeSet.size + creates.length < 1) {
      throw new BadRequestException('A product must keep at least one SKU');
    }

    return { removeIds: [...removeSet], updates, creates };
  }

  private async applySkuChanges(
    manager: EntityManager,
    productId: number,
    plan: SkuChangePlan,
  ) {
    if (plan.removeIds.length > 0) {
      await manager.softDelete(SellerProductSkuVariant, {
        sellerProductSkuId: In(plan.removeIds),
      });
      await manager.softDelete(SellerProductSku, { id: In(plan.removeIds) });
    }

    for (const { existing, dto } of plan.updates) {
      const patch: Record<string, unknown> = {};
      if (dto.description !== undefined) patch.description = dto.description;
      if (dto.quantity !== undefined) patch.quantity = dto.quantity;
      if (dto.lowStockThreshold !== undefined) {
        patch.lowStockThreshold = dto.lowStockThreshold;
      }
      if (dto.myBuyingPrice !== undefined) {
        patch.myBuyingPrice = dto.myBuyingPrice;
      }
      if (dto.price !== undefined) patch.price = dto.price;
      if (dto.discountedPrice !== undefined) {
        patch.discountedPrice = dto.discountedPrice;
      }
      if (dto.discountedPriceStartDate !== undefined) {
        patch.discountedPriceStartDate = new Date(dto.discountedPriceStartDate);
      }
      if (dto.discountedPriceEndDate !== undefined) {
        patch.discountedPriceEndDate = new Date(dto.discountedPriceEndDate);
      }
      if (dto.isActive !== undefined) patch.isActive = dto.isActive;
      if (dto.isDefault !== undefined) patch.isDefault = dto.isDefault;
      if (Object.keys(patch).length > 0) {
        await manager.update(SellerProductSku, existing.id, patch);
      }
    }

    let newDefaultId: number | undefined;
    for (const dto of plan.creates) {
      const saved = await this.insertSku(manager, productId, dto, false);
      if (dto.isDefault) {
        newDefaultId = saved.id;
      }
    }

    const explicitDefaultId =
      plan.updates.find((entry) => entry.dto.isDefault === true)?.existing.id ??
      newDefaultId;
    if (explicitDefaultId !== undefined) {
      await manager.update(
        SellerProductSku,
        { sellerProductId: productId, id: Not(explicitDefaultId) },
        { isDefault: false },
      );
      await manager.update(
        SellerProductSku,
        { id: explicitDefaultId },
        { isDefault: true },
      );
    }

    const remaining = await manager.find(SellerProductSku, {
      where: { sellerProductId: productId },
      order: { id: 'ASC' },
    });
    if (remaining.length > 0 && !remaining.some((sku) => sku.isDefault)) {
      await manager.update(SellerProductSku, remaining[0].id, {
        isDefault: true,
      });
    }
  }

  // ---- shared helpers ----

  private buildSlug(name: string): string {
    const slug = slugify(name);
    if (!slug) {
      throw new BadRequestException(
        'Name must contain at least one letter or number',
      );
    }
    return slug;
  }

  // Two SKUs of one product must not describe the same attribute/value set.
  private assertNoDuplicateCombos(
    combos: Array<Array<{ attributeId: number; attributeValueId: number }>>,
  ) {
    const seen = new Set<string>();
    for (const combo of combos) {
      const signature = combo
        .map((pair) => `${pair.attributeId}:${pair.attributeValueId}`)
        .sort()
        .join('|');
      if (seen.has(signature)) {
        throw new BadRequestException(
          'Two SKUs of this product have the same variants',
        );
      }
      seen.add(signature);
    }
  }

  // Maps a unique-constraint race (two concurrent requests with the same
  // name) to a clean 400 instead of a 500.
  private async runTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.dataSource.transaction(work);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code === '23505'
      ) {
        throw new BadRequestException(
          'This seller already has a product with this name',
        );
      }
      throw error;
    }
  }

  private pickSeller(seller?: Seller) {
    if (!seller) {
      return undefined;
    }
    const { id, name, email, phone, avatarUrl, status, activeStatus } = seller;
    return { id, name, email, phone, avatarUrl, status, activeStatus };
  }

  private toResponse(product: SellerProduct) {
    return {
      ...product,
      seller: this.pickSeller(product.seller),
      skus: product.skus
        ? [...product.skus].sort(
            (a, b) => Number(b.isDefault) - Number(a.isDefault) || a.id - b.id,
          )
        : undefined,
      media: product.media
        ? [...product.media].sort(
            (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
          )
        : undefined,
    };
  }

  private async findOrThrow(
    id: number,
    scope?: SellerScope,
  ): Promise<SellerProduct> {
    const product = await this.databaseService.sellerProduct.findOne({
      where: { id, ...(scope ? { sellerId: scope.sellerId } : {}) },
      relations: {
        seller: true,
        category: true,
        collection: true,
        media: true,
        skus: { variants: { attribute: true, attributeValue: true } },
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  // A seller only ever finds their own products; anything else is a 404.
  private async loadScoped(
    id: number,
    scope?: SellerScope,
  ): Promise<SellerProduct> {
    const product = await this.databaseService.sellerProduct.findOne({
      where: { id, ...(scope ? { sellerId: scope.sellerId } : {}) },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  // Rejected and suspended products are frozen for the seller.
  private assertSellerCanTouch(
    product: Pick<
      SellerProduct,
      'status' | 'activeStatus' | 'rejectionReason' | 'suspensionReason'
    >,
  ) {
    if (product.status === ProductStatus.REJECTED) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'PRODUCT_REJECTED',
        message: `This product was rejected by an admin, so you cannot change it.${
          product.rejectionReason ? ` Reason: ${product.rejectionReason}` : ''
        }`,
      });
    }
    if (product.activeStatus === ProductActiveStatus.SUSPENDED) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'PRODUCT_SUSPENDED',
        message: `This product was suspended by an admin, so you cannot change it.${
          product.suspensionReason ? ` Reason: ${product.suspensionReason}` : ''
        }`,
      });
    }
  }

  // Works out whether this edit moves status / activeStatus. Returns null when
  // nothing changes (no history row, no patch).
  private resolveStatusChange(
    current: SellerProduct,
    dto: UpdateProductDto,
    actor: Actor,
  ) {
    const isSeller = actor.type === AuthUserType.SELLER;
    if (
      isSeller &&
      (dto.status !== undefined ||
        dto.activeStatus === ProductActiveStatus.SUSPENDED)
    ) {
      throw new ForbiddenException(
        'Only an admin can change status or suspend a product',
      );
    }

    const toStatus = dto.status ?? current.status;
    const toActiveStatus = dto.activeStatus ?? current.activeStatus;
    if (
      toStatus === current.status &&
      toActiveStatus === current.activeStatus
    ) {
      return null;
    }

    const newlyRejected =
      toStatus === ProductStatus.REJECTED &&
      current.status !== ProductStatus.REJECTED;
    const newlySuspended =
      toActiveStatus === ProductActiveStatus.SUSPENDED &&
      current.activeStatus !== ProductActiveStatus.SUSPENDED;
    if ((newlyRejected || newlySuspended) && !dto.reason) {
      throw new BadRequestException(
        'A reason is required when rejecting or suspending a product',
      );
    }

    const patch: Record<string, unknown> = {
      status: toStatus,
      activeStatus: toActiveStatus,
    };
    if (toStatus !== ProductStatus.REJECTED) {
      patch.rejectionReason = null;
    } else if (newlyRejected) {
      patch.rejectionReason = dto.reason;
    }
    if (toActiveStatus !== ProductActiveStatus.SUSPENDED) {
      patch.suspensionReason = null;
    } else if (newlySuspended) {
      patch.suspensionReason = dto.reason;
    }
    return { patch, toStatus, toActiveStatus };
  }

  private async assertSellerIsEligible(sellerId: number) {
    const seller = await this.databaseService.seller.findOne({
      where: { id: sellerId },
    });
    if (!seller) {
      throw new BadRequestException('Seller not found');
    }
    if (
      seller.status !== SellerStatus.APPROVED ||
      seller.activeStatus !== SellerActiveStatus.ACTIVE
    ) {
      throw new ConflictException(
        'Seller must be approved and active to receive products',
      );
    }
  }

  private async assertCategoryExists(categoryId: number) {
    const category = await this.databaseService.category.findOne({
      where: { id: categoryId },
    });
    if (!category) {
      throw new BadRequestException('Category not found');
    }
  }

  private async assertCollectionExists(collectionId: number) {
    const collection = await this.databaseService.collection.findOne({
      where: { id: collectionId },
    });
    if (!collection) {
      throw new BadRequestException('Collection not found');
    }
  }

  private async assertSlugIsUnique(
    sellerId: number,
    slug: string,
    excludeId?: number,
  ) {
    const existing = await this.databaseService.sellerProduct.findOne({
      where: {
        sellerId,
        slug: ILike(slug),
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
      withDeleted: true,
    });
    if (existing) {
      throw new BadRequestException(
        'This seller already has a product with this name',
      );
    }
  }

  private async assertVariantsAreValid(variants: SkuVariantPairDto[]) {
    const attributeIds = new Set(variants.map((pair) => pair.attributeId));
    if (attributeIds.size !== variants.length) {
      throw new BadRequestException(
        'Each attribute can appear only once per SKU',
      );
    }

    for (const pair of variants) {
      const [attribute, value] = await Promise.all([
        this.databaseService.attribute.findOne({
          where: { id: pair.attributeId },
        }),
        this.databaseService.attributeValue.findOne({
          where: { id: pair.attributeValueId },
        }),
      ]);
      if (!attribute) {
        throw new BadRequestException(
          `Attribute ${pair.attributeId} not found`,
        );
      }
      if (!value || value.attributeId !== pair.attributeId) {
        throw new BadRequestException(
          `AttributeValue ${pair.attributeValueId} does not belong to attribute ${pair.attributeId}`,
        );
      }
    }
  }

  private assertDiscountIsValid(
    price: number,
    discountedPrice?: number,
    startDate?: string,
    endDate?: string,
  ) {
    if (discountedPrice !== undefined && discountedPrice > price) {
      throw new BadRequestException('discountedPrice cannot exceed price');
    }
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      throw new BadRequestException(
        'discountedPriceEndDate must be after discountedPriceStartDate',
      );
    }
  }
}
