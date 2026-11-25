import { PushService } from '../../push/services/push.service';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from '../../database/entities/person/user.entity';
import { SkuPriceProposal } from '../../database/entities/proposal/sku-price-proposal.entity';
import { SellerProductSku } from '../../database/entities/product/seller-product-sku.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import {
  ProposalParty,
  SkuPriceProposalAction,
  SkuPriceProposalStatus,
} from '../../database/enums/sku-price-proposal.enums';
import { CursorPagination } from '../../shared/decorators/cursor-pagination-params.decorator';
import { Actor } from '../../shared/types/actor.type';
import { getCursorPaginateData } from '../../shared/utils/cursor-paginate.util';
import { likeContains } from '../../shared/utils/like.util';
import { tidy } from '../../shared/utils/money.util';
import { effective, effectivePrice, StorefrontProductService } from '../../storefront/storefront-product.service';
import {
  CounterProposalDto,
  CreateProposalDto,
  ListAdminProposalsQueryDto,
  ListSellerProposalsQueryDto,
  ListUserProposalsQueryDto,
  ProposalNoteDto,
} from '../dtos/proposal.dtos';

export type ProposalActionName = 'accept' | 'counter' | 'reject' | 'cancel';

const OPEN = [SkuPriceProposalStatus.PENDING, SkuPriceProposalStatus.ACCEPTED];

// One proposal with the buyer, seller, product and SKU beside it. The SKU
// price is today's, to compare with the proposal. minProposalPrice is never read here.
const SELECT = `
  SELECT pr.id, pr.status, pr."awaitingParty", pr.quantity, pr.price, pr."skuPriceAtCreate",
         pr."closedByType", pr."closeNote", pr."acceptedAt", pr."usedAt", pr."orderId",
         pr."createdAt", pr."updatedAt",
         pr."userId", u.name AS "buyerName", pr."sellerId", s.name AS "sellerName",
         pr."sellerProductId" AS "productId", p.name AS "productName", p.slug AS "productSlug",
         p."thumbnailUrl" AS "thumbnailUrl",
         pr."sellerProductSkuId" AS "skuId", k.sku AS "skuCode", k."imageUrl" AS "skuImage",
         (SELECT string_agg(av.name, ' / ' ORDER BY v.id)
            FROM seller_product_sku_variant v JOIN attribute_value av ON av.id = v."attributeValueId"
           WHERE v."sellerProductSkuId" = k.id AND v."deletedAt" IS NULL) AS "skuLabel",
         ${effective('k')} AS "skuPriceNow", k.quantity AS "stock"
    FROM sku_price_proposal pr
    JOIN "user" u ON u.id = pr."userId"
    JOIN seller s ON s.id = pr."sellerId"
    JOIN seller_product p ON p.id = pr."sellerProductId"
    JOIN seller_product_sku k ON k.id = pr."sellerProductSkuId"`;

interface Row {
  id: number;
  status: SkuPriceProposalStatus;
  awaitingParty: ProposalParty | null;
  quantity: number;
  price: number;
  skuPriceAtCreate: number;
  skuPriceNow: number;
  stock: number;
  [key: string]: any;
}

/** What each side may do now. Only an admin can touch an accepted proposal. */
export function actionsFor(
  status: SkuPriceProposalStatus,
  awaiting: ProposalParty | null,
  viewer: AuthUserType,
): ProposalActionName[] {
  if (status === SkuPriceProposalStatus.ACCEPTED) return viewer === AuthUserType.ADMIN ? ['reject', 'cancel'] : [];
  if (status !== SkuPriceProposalStatus.PENDING) return [];
  if (viewer === AuthUserType.ADMIN) return ['reject', 'cancel'];
  if (viewer === AuthUserType.USER) {
    return awaiting === ProposalParty.BUYER ? ['accept', 'counter', 'reject', 'cancel'] : ['cancel'];
  }
  return awaiting === ProposalParty.SELLER ? ['accept', 'counter', 'reject'] : [];
}

@Injectable()
export class SkuPriceProposalService {
  constructor(
    @InjectRepository(SkuPriceProposal) private readonly repo: Repository<SkuPriceProposal>,
    private readonly storefront: StorefrontProductService,
    private readonly push: PushService,
  ) {}

  // ---- reading ----

  private view(r: Row, viewer: AuthUserType) {
    const open = OPEN.includes(r.status);
    return {
      id: r.id,
      status: r.status,
      awaitingParty: r.awaitingParty,
      quantity: r.quantity,
      price: r.price,
      total: tidy(r.price * r.quantity),
      skuPriceAtCreate: r.skuPriceAtCreate,
      // Today's SKU price. When it is below the proposal, the buyer pays the lower one.
      skuPriceNow: r.skuPriceNow,
      skuPriceNowLower: open && tidy(r.skuPriceNow) < tidy(r.price),
      stock: r.stock,
      buyer: { id: r.userId, name: r.buyerName },
      seller: { id: r.sellerId, name: r.sellerName },
      product: { id: r.productId, name: r.productName, slug: r.productSlug, thumbnailUrl: r.thumbnailUrl },
      sku: { id: r.skuId, sku: r.skuCode, label: r.skuLabel, imageUrl: r.skuImage },
      closedByType: r.closedByType,
      closeNote: r.closeNote,
      acceptedAt: r.acceptedAt,
      usedAt: r.usedAt,
      orderId: r.orderId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      actions: actionsFor(r.status, r.awaitingParty, viewer),
    };
  }

  private async history(proposalId: number) {
    return this.repo.query(
      `SELECT id, action, "actorType", "actorId", "actorName", price, quantity, "skuPriceAtTime", note, "createdAt"
         FROM sku_price_proposal_history WHERE "proposalId" = $1 AND "deletedAt" IS NULL ORDER BY id ASC`,
      [proposalId],
    );
  }

  private async list(
    viewer: AuthUserType,
    scope: { userId?: number; sellerId?: number },
    query: ListAdminProposalsQueryDto,
    pagination: CursorPagination,
  ) {
    const params: unknown[] = [];
    const add = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };
    const where: string[] = ['pr."deletedAt" IS NULL'];
    const userId = scope.userId ?? query.userId;
    const sellerId = scope.sellerId ?? query.sellerId;
    if (userId !== undefined) where.push(`pr."userId" = ${add(userId)}`);
    if (sellerId !== undefined) where.push(`pr."sellerId" = ${add(sellerId)}`);
    if (query.status) where.push(`pr.status = ${add(query.status)}`);
    if (query.awaiting) where.push(`pr.status = 'pending' AND pr."awaitingParty" = ${add(query.awaiting)}`);
    if (query.sellerProductSkuId !== undefined) where.push(`pr."sellerProductSkuId" = ${add(query.sellerProductSkuId)}`);
    if (query.productId !== undefined) where.push(`pr."sellerProductId" = ${add(query.productId)}`);
    if (query.search) where.push(`p.name ILIKE ${add(likeContains(query.search))}`);
    if (query.skuSearch) where.push(`k.sku ILIKE ${add(likeContains(query.skuSearch))}`);
    if (query.from) where.push(`pr."createdAt" >= ${add(query.from)}::date`);
    if (query.to) where.push(`pr."createdAt" < (${add(query.to)}::date + 1)`);
    if (query.minPrice !== undefined) where.push(`pr.price >= ${add(query.minPrice)}`);
    if (query.maxPrice !== undefined) where.push(`pr.price <= ${add(query.maxPrice)}`);
    if (query.buyerSearch) {
      const q = add(likeContains(query.buyerSearch));
      where.push(`(u.name ILIKE ${q} OR u.email ILIKE ${q} OR u.phone ILIKE ${q})`);
    }
    if (query.sellerSearch) where.push(`s.name ILIKE ${add(likeContains(query.sellerSearch))}`);
    if (pagination.cursor > 0) where.push(`pr.id < ${add(pagination.cursor)}`);

    const rows: Row[] = await this.repo.query(
      `${SELECT} WHERE ${where.join(' AND ')} ORDER BY pr.id DESC LIMIT ${add(pagination.limit)}`,
      params,
    );
    const page = getCursorPaginateData<Row>(rows, pagination.limit);
    return { ...page, results: page.results.map((r) => this.view(r, viewer)) };
  }

  private async one(id: number, viewer: AuthUserType, scope: { userId?: number; sellerId?: number }) {
    const params: unknown[] = [id];
    const where = ['pr.id = $1', 'pr."deletedAt" IS NULL'];
    if (scope.userId !== undefined) where.push(`pr."userId" = $${params.push(scope.userId)}`);
    if (scope.sellerId !== undefined) where.push(`pr."sellerId" = $${params.push(scope.sellerId)}`);
    const [row]: Row[] = await this.repo.query(`${SELECT} WHERE ${where.join(' AND ')}`, params);
    if (!row) throw new NotFoundException('Proposal not found');
    return { ...this.view(row, viewer), history: await this.history(id) };
  }

  listForUser(user: User, query: ListUserProposalsQueryDto, pagination: CursorPagination) {
    return this.list(AuthUserType.USER, { userId: user.id }, query, pagination);
  }

  getForUser(user: User, id: number) {
    return this.one(id, AuthUserType.USER, { userId: user.id });
  }

  /** The buyer's current proposal for a SKU (an open one first), or null. For the product page. */
  async forSku(user: User, skuId: number) {
    const [row]: Row[] = await this.repo.query(
      `${SELECT} WHERE pr."userId" = $1 AND pr."sellerProductSkuId" = $2 AND pr."deletedAt" IS NULL
        ORDER BY (pr.status IN ('pending', 'accepted')) DESC, pr.id DESC LIMIT 1`,
      [user.id, skuId],
    );
    return { proposal: row ? { ...this.view(row, AuthUserType.USER), history: await this.history(row.id) } : null };
  }

  listForSeller(sellerId: number, query: ListSellerProposalsQueryDto, pagination: CursorPagination) {
    return this.list(AuthUserType.SELLER, { sellerId }, query, pagination);
  }

  getForSeller(sellerId: number, id: number) {
    return this.one(id, AuthUserType.SELLER, { sellerId });
  }

  /** Counts for the seller menu badge. */
  async sellerSummary(sellerId: number) {
    const [r] = await this.repo.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS "pending",
              COUNT(*) FILTER (WHERE status = 'pending' AND "awaitingParty" = 'seller')::int AS "awaitingYou",
              COUNT(*) FILTER (WHERE status = 'accepted')::int AS "accepted",
              COUNT(*) FILTER (WHERE status = 'used')::int AS "used",
              COUNT(*) FILTER (WHERE status IN ('rejected', 'cancelled'))::int AS "closed"
         FROM sku_price_proposal WHERE "sellerId" = $1 AND "deletedAt" IS NULL`,
      [sellerId],
    );
    return r;
  }

  listForAdmin(query: ListAdminProposalsQueryDto, pagination: CursorPagination) {
    return this.list(AuthUserType.ADMIN, {}, query, pagination);
  }

  getForAdmin(id: number) {
    return this.one(id, AuthUserType.ADMIN, {});
  }

  // ---- writing ----

  private stamp(actor: Actor) {
    return [actor.id, actor.type, actor.name];
  }

  private async log(
    m: EntityManager,
    proposalId: number,
    action: SkuPriceProposalAction,
    actor: Actor,
    price: number,
    quantity: number,
    skuPrice: number,
    note?: string | null,
  ) {
    await m.query(
      `INSERT INTO sku_price_proposal_history
         ("proposalId", action, "actorType", "actorId", "actorName", price, quantity, "skuPriceAtTime", note,
          "createdBy", "creatorType", "creatorName", "updatedBy", "updaterType", "updaterName")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $4, $3, $5, $4, $3, $5)`,
      [proposalId, action, actor.type, actor.id, actor.name, price, quantity, skuPrice, note ?? null],
    );
  }

  /** The buyer starts a proposal. A price under the seller's hidden floor is turned down at once. */
  async create(user: User, dto: CreateProposalDto) {
    const sku = await this.repo.manager.findOne(SellerProductSku, {
      where: { id: dto.sellerProductSkuId, isActive: true },
    });
    if (!sku) throw new NotFoundException('Item not found');
    const product = await this.storefront
      .eligibleProducts()
      .andWhere('p.id = :id', { id: sku.sellerProductId })
      .getOne();
    if (!product) throw new NotFoundException('Item not found');
    if (!sku.acceptProposals) throw new BadRequestException('The seller does not take price proposals for this item');
    if (sku.quantity <= 0) throw new BadRequestException('This item is out of stock');
    if (dto.quantity > sku.quantity) throw new BadRequestException(`Only ${sku.quantity} in stock`);

    const [open] = await this.repo.query(
      `SELECT id FROM sku_price_proposal WHERE "userId" = $1 AND "sellerProductSkuId" = $2
          AND "deletedAt" IS NULL AND status IN ('pending', 'accepted')`,
      [user.id, sku.id],
    );
    if (open) throw new ConflictException('You already have an open proposal for this item');

    const buyer: Actor = { id: user.id, type: AuthUserType.USER, name: user.name };
    const seller: Actor = { id: product.sellerId, type: AuthUserType.SELLER, name: product.seller.name };
    const skuPrice = effectivePrice(sku);
    const floor = sku.minProposalPrice;
    const declined = floor !== null && floor !== undefined && tidy(dto.price) < tidy(floor);

    let id: number;
    try {
      id = await this.repo.manager.transaction(async (m) => {
        const [row]: { id: number }[] = await m.query(
          `INSERT INTO sku_price_proposal
             ("userId", "sellerId", "sellerProductId", "sellerProductSkuId", quantity, price, "skuPriceAtCreate",
              status, "awaitingParty", "closedByType", "closedById", "closeNote",
              "createdBy", "creatorType", "creatorName", "updatedBy", "updaterType", "updaterName")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $1, $13, $14, $1, $13, $14)
           RETURNING id`,
          [
            user.id,
            product.sellerId,
            product.id,
            sku.id,
            dto.quantity,
            dto.price,
            skuPrice,
            declined ? SkuPriceProposalStatus.REJECTED : SkuPriceProposalStatus.PENDING,
            declined ? null : ProposalParty.SELLER,
            declined ? AuthUserType.SELLER : null,
            declined ? seller.id : null,
            declined ? 'The seller declined this price' : null,
            buyer.type,
            buyer.name,
          ],
        );
        await this.log(m, row.id, SkuPriceProposalAction.CREATED, buyer, dto.price, dto.quantity, skuPrice, dto.note);
        if (declined) {
          await this.log(m, row.id, SkuPriceProposalAction.REJECTED, seller, dto.price, dto.quantity, skuPrice, 'The seller declined this price');
        }
        return row.id;
      });
    } catch (e: any) {
      if ((e?.code ?? e?.driverError?.code) === '23505') {
        throw new ConflictException('You already have an open proposal for this item');
      }
      throw e;
    }
    if (!declined) {
      this.push.notifySeller(product.sellerId, { title: 'New price offer', body: `${product.name}: ${dto.quantity} x ${dto.price}`, data: { route: `/more/offers/${id}` } });
    }
    return this.one(id, AuthUserType.USER, { userId: user.id });
  }

  async accept(actor: Actor, id: number, dto: ProposalNoteDto) {
    return this.act(actor, id, 'accept', dto);
  }

  async counter(actor: Actor, id: number, dto: CounterProposalDto) {
    return this.act(actor, id, 'counter', dto);
  }

  async reject(actor: Actor, id: number, dto: ProposalNoteDto) {
    return this.act(actor, id, 'reject', dto);
  }

  async cancel(actor: Actor, id: number, dto: ProposalNoteDto) {
    return this.act(actor, id, 'cancel', dto);
  }

  /**
   * One step. The row is locked so two answers cannot race, then the rules
   * decide: only the side whose turn it is can answer a pending proposal, the
   * buyer can cancel it any time while it is pending, and an accepted one can
   * be closed by an admin only.
   */
  private async act(
    actor: Actor,
    id: number,
    action: ProposalActionName,
    dto: { price?: number; quantity?: number; note?: string },
  ) {
    await this.repo.manager.transaction(async (m) => {
      // Checkout and the cart lock the cart first and the proposal second; take
      // the carts holding this proposal first too, so the two never deadlock.
      await m.query(
        `SELECT c.id FROM cart c
          WHERE c.id IN (SELECT "cartId" FROM cart_item WHERE "proposalId" = $1)
          ORDER BY c.id FOR UPDATE`,
        [id],
      );
      const [p]: SkuPriceProposal[] = await m.query(
        `SELECT * FROM sku_price_proposal WHERE id = $1 AND "deletedAt" IS NULL FOR UPDATE`,
        [id],
      );
      const owns =
        actor.type === AuthUserType.ADMIN ||
        (actor.type === AuthUserType.USER && p?.userId === actor.id) ||
        (actor.type === AuthUserType.SELLER && p?.sellerId === actor.id);
      if (!p || !owns) throw new NotFoundException('Proposal not found');

      if (!actionsFor(p.status, p.awaitingParty, actor.type).includes(action)) {
        throw new ConflictException(this.whyNot(p, actor.type));
      }

      const [sku] = await m.query(
        `SELECT ${effective('k')} AS "skuPrice", k."minProposalPrice" AS "floor", k.quantity AS "stock"
           FROM seller_product_sku k WHERE k.id = $1`,
        [p.sellerProductSkuId],
      );
      const note = dto.note ?? null;
      let price = Number(p.price);
      let quantity = p.quantity;
      let history: SkuPriceProposalAction;
      let status = p.status;
      let awaiting: ProposalParty | null = p.awaitingParty;
      let closedByType: AuthUserType | null = null;
      let closedById: number | null = null;
      let closeNote: string | null = null;
      let acceptedAt: Date | null = null;
      let declinedByFloor = false;

      if (action === 'accept') {
        status = SkuPriceProposalStatus.ACCEPTED;
        awaiting = null;
        acceptedAt = new Date();
        history = SkuPriceProposalAction.ACCEPTED;
      } else if (action === 'counter') {
        price = dto.price as number;
        quantity = dto.quantity ?? p.quantity;
        if (quantity > sku.stock) throw new BadRequestException(`Only ${sku.stock} in stock`);
        history = SkuPriceProposalAction.COUNTERED;
        if (actor.type === AuthUserType.USER && sku.floor !== null && tidy(price) < tidy(sku.floor)) {
          declinedByFloor = true;
        } else {
          awaiting = actor.type === AuthUserType.USER ? ProposalParty.SELLER : ProposalParty.BUYER;
        }
      } else {
        status = action === 'reject' ? SkuPriceProposalStatus.REJECTED : SkuPriceProposalStatus.CANCELLED;
        awaiting = null;
        closedByType = actor.type;
        closedById = actor.id;
        closeNote = note;
        history = action === 'reject' ? SkuPriceProposalAction.REJECTED : SkuPriceProposalAction.CANCELLED;
      }

      if (declinedByFloor) {
        status = SkuPriceProposalStatus.REJECTED;
        awaiting = null;
        closedByType = AuthUserType.SELLER;
        closedById = p.sellerId;
        closeNote = 'The seller declined this price';
      }

      await m.query(
        `UPDATE sku_price_proposal
            SET price = $2, quantity = $3, status = $4, "awaitingParty" = $5,
                "closedByType" = $6, "closedById" = $7, "closeNote" = $8,
                "acceptedAt" = COALESCE($9, "acceptedAt"),
                "updatedBy" = $10, "updaterType" = $11, "updaterName" = $12, "updatedAt" = now()
          WHERE id = $1`,
        [id, price, quantity, status, awaiting, closedByType, closedById, closeNote, acceptedAt, ...this.stamp(actor)],
      );
      await this.log(m, id, history, actor, price, quantity, sku.skuPrice, note);
      if (p.status === SkuPriceProposalStatus.ACCEPTED) await this.releaseCarts(m, id);
      if (declinedByFloor) {
        const [s] = await m.query(`SELECT name FROM seller WHERE id = $1`, [p.sellerId]);
        await this.log(
          m,
          id,
          SkuPriceProposalAction.REJECTED,
          { id: p.sellerId, type: AuthUserType.SELLER, name: s?.name ?? 'Seller' },
          price,
          quantity,
          sku.skuPrice,
          'The seller declined this price',
        );
      }
    });
    return this.one(id, actor.type, {
      userId: actor.type === AuthUserType.USER ? actor.id : undefined,
      sellerId: actor.type === AuthUserType.SELLER ? actor.id : undefined,
    });
  }

  /**
   * An accepted proposal was closed: every cart line bought at it goes back to
   * the SKU price (the line keeps the proposal id so the cart can say why),
   * and those carts' stored totals follow.
   */
  private async releaseCarts(m: EntityManager, proposalId: number) {
    const [lines]: [{ cartId: number }[], number] = await m.query(
      `UPDATE cart_item SET "unitProposalPrice" = NULL, "totalProposalPrice" = NULL, "updatedAt" = now()
        WHERE "proposalId" = $1 AND "unitProposalPrice" IS NOT NULL AND "deletedAt" IS NULL
        RETURNING "cartId"`,
      [proposalId],
    );
    if (lines.length === 0) return;
    await m.query(
      `UPDATE cart c SET "totalPrice" = s.list, "totalDiscountedPrice" = s.payable, "updatedAt" = now()
         FROM (SELECT "cartId", SUM("totalPrice") AS list, SUM(COALESCE("totalProposalPrice", "totalDiscountedPrice")) AS payable
                 FROM cart_item WHERE "cartId" = ANY($1) AND "deletedAt" IS NULL GROUP BY "cartId") s
        WHERE c.id = s."cartId"`,
      [[...new Set(lines.map((l) => l.cartId))]],
    );
  }

  private whyNot(p: SkuPriceProposal, viewer: AuthUserType) {
    if (p.status === SkuPriceProposalStatus.ACCEPTED) return 'An accepted proposal can only be changed by an admin';
    if (p.status !== SkuPriceProposalStatus.PENDING) return `This proposal is already ${p.status}`;
    if (viewer === AuthUserType.USER) return 'Waiting for the seller to answer. You can cancel the proposal instead.';
    return 'Waiting for the buyer to answer';
  }
}
