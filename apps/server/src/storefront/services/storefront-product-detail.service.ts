import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { MediaType } from '../../database/enums/media-type.enum';
import {
  effectivePrice,
  isDiscountLive,
  StorefrontProductService,
} from '../storefront-product.service';

@Injectable()
export class StorefrontProductDetailService {
  constructor(
    private readonly db: DatabaseService,
    private readonly products: StorefrontProductService,
  ) {}

  async details(id: number) {
    const product = await this.products
      .eligibleProducts()
      .leftJoinAndSelect('p.collection', 'col')
      .andWhere('p.id = :id', { id })
      .getOne();
    if (!product) throw new NotFoundException('Product not found');

    const [skus, media, breadcrumb, related, sellerProducts] = await Promise.all([
      this.db.sellerProductSku
        .createQueryBuilder('k')
        .leftJoinAndSelect('k.variants', 'v', 'v.isActive = true AND v.deletedAt IS NULL')
        .leftJoinAndSelect('v.attribute', 'a')
        .leftJoinAndSelect('v.attributeValue', 'av')
        .where('k.sellerProductId = :id', { id })
        .andWhere('k.isActive = true')
        .orderBy('k.isDefault', 'DESC')
        .addOrderBy('k.id', 'ASC')
        .getMany(),
      this.db.sellerProductMedia
        .createQueryBuilder('m')
        .where('m.sellerProductId = :id', { id })
        .andWhere('m.isActive = true')
        .orderBy('m.isPrimary', 'DESC')
        .addOrderBy('m.sortOrder', 'ASC')
        .addOrderBy('m.id', 'ASC')
        .getMany(),
      this.breadcrumb(product.categoryId),
      this.products.search(
        { categoryId: product.categoryId, includeSubcategories: false },
        { page: 1, pageSize: 7, offset: 0 },
      ),
      this.products.countBySeller([product.sellerId]),
    ]);

    const now = new Date();
    const skuViews = skus.map((k) => ({
      id: k.id,
      sku: k.sku,
      description: k.description ?? null,
      imageUrl: k.imageUrl ?? null,
      price: Number(k.price),
      discountedPrice: isDiscountLive(k, now) ? Number(k.discountedPrice) : null,
      effectivePrice: effectivePrice(k, now),
      quantity: k.quantity,
      inStock: k.quantity > 0,
      lowStock: k.quantity > 0 && k.quantity <= k.lowStockThreshold,
      isDefault: k.isDefault,
      variants: (k.variants ?? []).map((v) => ({
        attributeId: v.attributeId,
        valueId: v.attributeValueId,
      })),
    }));

    // Option groups for the picker, built from the variants of live SKUs.
    const groups = new Map<
      number,
      { attributeId: number; name: string; values: Map<number, { id: number; name: string; colorCode: string | null; sortOrder: number }> }
    >();
    for (const k of skus) {
      for (const v of k.variants ?? []) {
        if (!v.attribute || !v.attributeValue) continue;
        const group =
          groups.get(v.attributeId) ??
          { attributeId: v.attributeId, name: v.attribute.name, values: new Map() };
        group.values.set(v.attributeValueId, {
          id: v.attributeValueId,
          name: v.attributeValue.name,
          colorCode: v.attributeValue.colorCode ?? null,
          sortOrder: v.attributeValue.sortOrder,
        });
        groups.set(v.attributeId, group);
      }
    }
    const options = [...groups.values()]
      .sort((a, b) => a.attributeId - b.attributeId)
      .map((g) => ({
        attributeId: g.attributeId,
        name: g.name,
        values: [...g.values.values()]
          .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
          .map(({ id: valueId, name, colorCode }) => ({ id: valueId, name, colorCode })),
      }));

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description ?? null,
      thumbnailUrl: product.thumbnailUrl ?? null,
      isFeatured: product.isFeatured,
      seoTitle: product.seoTitle ?? null,
      seoDescription: product.seoDescription ?? null,
      category: product.category
        ? { id: product.category.id, name: product.category.name, slug: product.category.slug }
        : null,
      breadcrumb,
      collection:
        product.collection && product.collection.isActive
          ? {
              id: product.collection.id,
              name: product.collection.name,
              slug: product.collection.slug,
              colorCode: product.collection.colorCode ?? null,
            }
          : null,
      seller: {
        id: product.seller.id,
        name: product.seller.name,
        avatarUrl: product.seller.avatarUrl ?? null,
        productCount: sellerProducts.get(product.sellerId) ?? 0,
      },
      options,
      skus: skuViews,
      media: media.map((m) => ({
        id: m.id,
        url: m.url,
        type: m.type as MediaType,
        altText: m.altText ?? null,
        isPrimary: m.isPrimary,
      })),
      related: related.items.filter((c) => c.id !== product.id).slice(0, 6),
    };
  }

  /** Root -> category, for the page's trail. */
  private async breadcrumb(categoryId: number) {
    const all = await this.db.category.find();
    const byId = new Map(all.map((c) => [c.id, c]));
    const trail: { id: number; name: string; slug: string }[] = [];
    for (let cur = byId.get(categoryId); cur; cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
      trail.unshift({ id: cur.id, name: cur.name, slug: cur.slug });
    }
    return trail;
  }
}
