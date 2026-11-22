import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Cart } from '../../database/entities/cart/cart.entity';
import { CartItem } from '../../database/entities/cart/cart-item.entity';
import { ProductActiveStatus } from '../../database/enums/product-active-status.enum';
import { ProductStatus } from '../../database/enums/product-status.enum';
import { SellerActiveStatus } from '../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../database/enums/seller-status.enum';
import { SkuPriceProposalStatus } from '../../database/enums/sku-price-proposal.enums';
import { effectivePrice } from '../../storefront/storefront-product.service';
import { tidy } from '../../shared/utils/money.util';

export type CartLineStatus = 'ok' | 'unavailable' | 'out_of_stock' | 'insufficient_stock';

export interface CartLineView {
  id: number;
  product: { id: number; name: string; slug: string; thumbnailUrl: string | null } | null;
  sku: { id: number; code: string; imageUrl: string | null; label: string } | null;
  quantity: number;
  /** Right now, from the live SKU. */
  unitPrice: number;
  unitPayable: number;
  linePayable: number;
  availableQuantity: number;
  status: CartLineStatus;
  /** The price when the item was added differs from the live price. */
  priceChanged: boolean;
  previousUnitPayable: number;
  /** The live SKU price, whatever the line pays. */
  skuUnitPayable: number;
  /** The accepted proposal this line is bought at. applied: false when the SKU is now cheaper. */
  proposal: { id: number; unitPrice: number; applied: boolean } | null;
  /** Said when a proposal no longer applies, or the SKU became cheaper than it. */
  proposalNotice: string | null;
}

export interface CartView {
  id: number;
  isActive: boolean;
  seller: { id: number; name: string; avatarUrl: string | null };
  lines: CartLineView[];
  totals: { itemCount: number; listTotal: number; payableTotal: number; savings: number };
  /** Every line can be bought right now. */
  canCheckout: boolean;
  issues: string[];
  /** Things to tell the customer that do not block checkout. */
  notices: string[];
  updatedAt: Date;
}

const round2 = tidy;

/** Builds the cart a customer or admin sees, always from live prices and stock. */
@Injectable()
export class CartViewService {
  constructor(private readonly db: DatabaseService) {}

  async load(cartId: number) {
    return this.db.cart.findOne({
      where: { id: cartId },
      relations: {
        seller: true,
        user: true,
        items: { product: true, proposal: true, sku: { variants: { attribute: true, attributeValue: true } } },
      },
      order: { items: { id: 'ASC' } },
    });
  }

  async build(cartId: number): Promise<CartView | null> {
    const cart = await this.load(cartId);
    return cart ? this.fromCart(cart) : null;
  }

  fromCart(cart: Cart): CartView {
    const seller = cart.seller;
    const sellerLive =
      !!seller &&
      !seller.deletedAt &&
      seller.status === SellerStatus.APPROVED &&
      seller.activeStatus === SellerActiveStatus.ACTIVE;

    const lines = (cart.items ?? []).map((item) => this.line(item, sellerLive));
    const ok = lines.filter((l) => l.status === 'ok');

    const itemCount = ok.reduce((n, l) => n + l.quantity, 0);
    const listTotal = round2(ok.reduce((n, l) => n + l.unitPrice * l.quantity, 0));
    const payableTotal = round2(ok.reduce((n, l) => n + l.linePayable, 0));

    const issues: string[] = [];
    for (const l of lines) {
      const name = l.product?.name ?? 'An item';
      if (l.status === 'unavailable') issues.push(`${name} is no longer available.`);
      else if (l.status === 'out_of_stock') issues.push(`${name} is out of stock.`);
      else if (l.status === 'insufficient_stock') issues.push(`Only ${l.availableQuantity} of ${name} left.`);
    }

    const notices = lines.map((l) => l.proposalNotice).filter((n): n is string => !!n);

    return {
      id: cart.id,
      isActive: cart.isActive,
      seller: {
        id: cart.sellerId,
        name: seller?.name ?? 'Seller',
        avatarUrl: seller?.avatarUrl ?? null,
      },
      lines,
      totals: { itemCount, listTotal, payableTotal, savings: round2(listTotal - payableTotal) },
      canCheckout: lines.length > 0 && issues.length === 0,
      issues,
      notices,
      updatedAt: cart.updatedAt,
    };
  }

  private line(item: CartItem, sellerLive: boolean): CartLineView {
    const { product, sku } = item;
    const productLive =
      !!product &&
      !product.deletedAt &&
      product.status === ProductStatus.APPROVED &&
      product.activeStatus === ProductActiveStatus.ACTIVE;
    const skuLive = !!sku && !sku.deletedAt && sku.isActive;
    const previous = Number(item.unitDiscountedPrice ?? item.unitPrice);

    let status: CartLineStatus = 'ok';
    let available = 0;
    let unitPrice = Number(item.unitPrice);
    let unitPayable = previous;
    let skuUnitPayable = previous;
    let proposal: CartLineView['proposal'] = null;
    let proposalNotice: string | null = null;

    if (!sellerLive || !productLive || !skuLive) {
      status = 'unavailable';
    } else {
      available = sku.quantity;
      unitPrice = Number(sku.price);
      unitPayable = effectivePrice(sku);
      skuUnitPayable = unitPayable;
      if (available <= 0) status = 'out_of_stock';
      else if (item.quantity > available) status = 'insufficient_stock';
    }

    // A proposal price holds while the proposal is accepted. When the SKU gets
    // cheaper than it, the customer pays the lower SKU price and is told so.
    if (item.proposalId) {
      const live = item.proposal?.status === SkuPriceProposalStatus.ACCEPTED && item.unitProposalPrice != null;
      if (live) {
        const agreed = Number(item.unitProposalPrice);
        const cheaper = status !== 'unavailable' && tidy(skuUnitPayable) < tidy(agreed);
        proposal = { id: item.proposalId, unitPrice: agreed, applied: !cheaper };
        if (cheaper) {
          proposalNotice = `${product?.name ?? 'This item'} is now cheaper than your proposal price (${agreed}). You will pay the lower price (${skuUnitPayable}).`;
        } else {
          unitPayable = agreed;
        }
      } else if (item.proposal) {
        const by = item.proposal.closedByType === 'admin' ? ' by an admin' : '';
        const what = item.proposal.status === SkuPriceProposalStatus.USED ? 'was already used' : `was ${item.proposal.status}${by}`;
        proposalNotice = `Your price proposal for ${product?.name ?? 'this item'} ${what}. It is at its regular price.`;
      }
    }

    return {
      id: item.id,
      product: product
        ? { id: product.id, name: product.name, slug: product.slug, thumbnailUrl: product.thumbnailUrl ?? null }
        : null,
      sku: sku
        ? {
            id: sku.id,
            code: sku.sku,
            imageUrl: sku.imageUrl ?? null,
            label: (sku.variants ?? [])
              .filter((v) => v.attribute && v.attributeValue)
              .map((v) => `${v.attribute.name}: ${v.attributeValue.name}`)
              .join(' / '),
          }
        : null,
      quantity: item.quantity,
      unitPrice,
      unitPayable,
      linePayable: round2(unitPayable * item.quantity),
      availableQuantity: available,
      status,
      priceChanged: !proposal && status !== 'unavailable' && Math.abs(tidy(unitPayable) - tidy(previous)) > 1e-9,
      previousUnitPayable: previous,
      skuUnitPayable,
      proposal,
      proposalNotice,
    };
  }
}
