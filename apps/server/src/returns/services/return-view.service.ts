import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { OrderItem } from '../../database/entities/order/order-item.entity';
import { OrderReturn } from '../../database/entities/order-return/order-return.entity';
import { OrderReturnAttachment } from '../../database/entities/order-return/order-return-attachment.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { ReturnScope } from '../../database/enums/return-scope.enum';
import { ReturnStatus } from '../../database/enums/return-status.enum';
import { likeContains } from '../../shared/utils/like.util';
import { pageResult, resolvePage } from '../../shared/utils/page-paginate.util';
import { AdminListReturnsQueryDto } from '../dtos/returns.dtos';

/** Who is looking, and which returns they may see. */
export interface ReturnScopeFilter {
  viewer: AuthUserType;
  userId?: number;
  sellerId?: number;
}

/** What a seller can do next from each status. */
export const SELLER_NEXT: Partial<Record<ReturnStatus, string[]>> = {
  [ReturnStatus.RETURN_REQUESTED]: ['accept', 'reject'],
  [ReturnStatus.ACCEPTED]: ['processing'],
  [ReturnStatus.PROCESSING]: ['returning_money'],
};

/** Reads returns for the customer, the seller and the admin. */
@Injectable()
export class ReturnViewService {
  constructor(private readonly db: DatabaseService) {}

  private base(filter: ReturnScopeFilter) {
    const qb = this.db.orderReturn
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.order', 'o')
      .leftJoinAndSelect('o.seller', 's')
      .leftJoinAndSelect('r.items', 'ri')
      .leftJoinAndSelect('ri.orderItem', 'oi');
    if (filter.userId !== undefined) qb.andWhere('r.userId = :userId', { userId: filter.userId });
    if (filter.sellerId !== undefined) qb.andWhere('r.sellerId = :sellerId', { sellerId: filter.sellerId });
    return qb;
  }

  async list(filter: ReturnScopeFilter, query: AdminListReturnsQueryDto) {
    const page = resolvePage(query);
    const qb = this.base(filter);
    if (query.status) qb.andWhere('r.status = :status', { status: query.status });
    if (query.scope) qb.andWhere('r.scope = :scope', { scope: query.scope });
    if (query.orderId) qb.andWhere('r.orderId = :orderId', { orderId: query.orderId });
    if (filter.viewer === AuthUserType.ADMIN) {
      if (query.sellerId) qb.andWhere('r.sellerId = :qSeller', { qSeller: query.sellerId });
      if (query.userId) qb.andWhere('r.userId = :qUser', { qUser: query.userId });
    }
    if (query.search) {
      qb.andWhere('(r.returnNumber ILIKE :q OR o.orderNumber ILIKE :q)', { q: likeContains(query.search) });
    }
    // Page first, then load the lines, so a return with many lines is never cut in half.
    const idRows = await qb.clone().select('r.id', 'id').orderBy('r.id', 'DESC').offset(page.offset).limit(page.pageSize).getRawMany();
    const total = await qb.clone().select('r.id').getCount();
    const ids = idRows.map((r) => Number(r.id));
    const rows = ids.length
      ? await this.base(filter).andWhere('r.id IN (:...ids)', { ids }).orderBy('r.id', 'DESC').addOrderBy('ri.id', 'ASC').getMany()
      : [];
    return pageResult(
      rows.map((r) => this.summary(r, filter.viewer)),
      total,
      page,
    );
  }

  async detail(filter: ReturnScopeFilter, id: number) {
    const ret = await this.base(filter)
      .leftJoinAndSelect('r.statusHistory', 'h')
      .leftJoinAndSelect('r.attachments', 'a')
      .leftJoinAndSelect('o.user', 'u')
      .andWhere('r.id = :id', { id })
      .orderBy('h.id', 'ASC')
      .addOrderBy('ri.id', 'ASC')
      .getOne();
    if (!ret) throw new NotFoundException('Return not found');
    return this.full(ret, filter.viewer);
  }

  /** Every return on one order, newest first. Used on the order screens. */
  async forOrder(orderId: number) {
    const rows = await this.db.orderReturn.find({
      where: { orderId },
      relations: { items: true },
      order: { id: 'DESC' },
    });
    return rows.map((r) => ({
      id: r.id,
      returnNumber: r.returnNumber,
      status: r.status,
      scope: r.scope,
      refundAmount: r.refundAmount,
      orderItemIds: (r.items ?? []).map((i) => i.orderItemId),
      createdAt: r.createdAt,
    }));
  }

  summary(r: OrderReturn, viewer: AuthUserType) {
    return {
      id: r.id,
      returnNumber: r.returnNumber,
      status: r.status,
      scope: r.scope,
      reason: r.reason,
      order: this.orderRef(r),
      seller: r.order?.seller ? { id: r.order.seller.id, name: r.order.seller.name } : { id: r.sellerId, name: 'Seller' },
      itemCount: (r.items ?? []).length,
      previewItems: (r.items ?? []).slice(0, 3).map((i) => ({ productName: i.orderItem?.productName ?? 'Item' })),
      refundAmount: r.refundAmount,
      includeDeliveryCharge: r.includeDeliveryCharge,
      ...(viewer === AuthUserType.USER ? {} : { commissionAmount: r.commissionAmount }),
      createdAt: r.createdAt,
      returnedAt: r.returnedAt,
      requestedBy: { name: r.creatorName, type: r.creatorType },
    };
  }

  private orderRef(r: OrderReturn) {
    return {
      id: r.orderId,
      orderNumber: r.order?.orderNumber ?? null,
      status: r.order?.status ?? null,
      isReturned: r.order?.isReturned ?? false,
    };
  }

  private item(ri: { id: number; orderItemId: number; quantity: number; refundAmount: number; commissionAmount: number; reason: string | null; orderItem?: OrderItem }, viewer: AuthUserType) {
    const oi = ri.orderItem;
    const sku = (oi?.skuData ?? {}) as { label?: string; thumbnailUrl?: string; imageUrl?: string; slug?: string };
    return {
      id: ri.id,
      orderItemId: ri.orderItemId,
      productName: oi?.productName ?? 'Item',
      productId: oi?.sellerProductId ?? null,
      skuLabel: sku.label ?? null,
      imageUrl: sku.thumbnailUrl ?? sku.imageUrl ?? null,
      quantity: ri.quantity,
      refundAmount: ri.refundAmount,
      isReturned: oi?.isReturned ?? false,
      ...(viewer === AuthUserType.USER ? {} : { commissionAmount: ri.commissionAmount }),
    };
  }

  private attachment(a: OrderReturnAttachment) {
    return {
      id: a.id,
      kind: a.kind,
      fileName: a.fileName,
      url: a.fileUrl,
      mimeType: a.mimeType,
      size: a.size,
      uploadedBy: { name: a.creatorName, type: a.creatorType },
      createdAt: a.createdAt,
    };
  }

  full(r: OrderReturn, viewer: AuthUserType) {
    const attachments = r.attachments ?? [];
    const history = (r.statusHistory ?? []).map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      status: h.status,
      note: h.note,
      by: { name: h.creatorName, type: h.creatorType },
      createdAt: h.createdAt,
      attachments: attachments.filter((a) => a.statusHistoryId === h.id).map((a) => this.attachment(a)),
    }));
    const open = r.status !== ReturnStatus.REJECTED && r.status !== ReturnStatus.CANCELLED && r.status !== ReturnStatus.RETURNED;
    return {
      ...this.summary(r, viewer),
      itemsAmount: r.itemsAmount,
      deliveryAmount: r.deliveryAmount,
      deliveryCharge: r.order?.deliveryCharge ?? 0,
      items: (r.items ?? []).map((i) => this.item(i, viewer)),
      customer: {
        userId: r.userId,
        isGuest: r.userId === null,
        name: r.order?.recipientName ?? null,
        phone: r.order?.recipientPhone ?? null,
        email: r.order?.contactEmail ?? null,
      },
      history,
      // What this viewer may do next.
      actions: {
        canCancel: viewer !== AuthUserType.SELLER && r.status === ReturnStatus.RETURN_REQUESTED,
        sellerNext: viewer === AuthUserType.SELLER ? (SELLER_NEXT[r.status] ?? []) : [],
        adminTargets:
          viewer === AuthUserType.ADMIN ? Object.values(ReturnStatus).filter((s) => s !== r.status) : [],
        canEditDelivery: viewer !== AuthUserType.USER && r.scope === ReturnScope.FULL_ORDER && open,
      },
    };
  }
}
