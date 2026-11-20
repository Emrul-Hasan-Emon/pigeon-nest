import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CartOwner } from '../../auth/guards/optional-customer.guard';
import { DatabaseService } from '../../database/database.service';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { OrderStatus } from '../../database/enums/order-status.enum';
import { likeContains } from '../../shared/utils/like.util';
import { pageResult, resolvePage } from '../../shared/utils/page-paginate.util';
import { normalizePhone } from '../../shared/utils/phone.util';
import { UserOrderQueryDto } from '../dtos/order.dtos';
import { OrderStatusService } from './order-status.service';
import { OrderViewService } from './order-view.service';

/** A customer's (or guest's) own orders. */
@Injectable()
export class UserOrderService {
  constructor(
    private readonly db: DatabaseService,
    private readonly views: OrderViewService,
    private readonly status: OrderStatusService,
  ) {}

  async list(owner: CartOwner, query: UserOrderQueryDto) {
    this.requireOwner(owner);
    const page = resolvePage(query);
    const qb = this.db.order
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.seller', 's')
      .leftJoinAndSelect('o.items', 'i')
      .where(owner.userId ? 'o.userId = :userId' : 'o.guestSessionId = :sessionId', {
        userId: owner.userId,
        sessionId: owner.sessionId,
      });
    if (query.status) qb.andWhere('o.status = :status', { status: query.status });
    if (query.paymentStatus) qb.andWhere('o.paymentStatus = :ps', { ps: query.paymentStatus });
    if (query.search) qb.andWhere('o.orderNumber ILIKE :q', { q: likeContains(query.search) });
    const [rows, total] = await qb
      .orderBy('o.id', 'DESC')
      .addOrderBy('i.id', 'ASC')
      .skip(page.offset)
      .take(page.pageSize)
      .getManyAndCount();
    return pageResult(
      rows.map((o) => this.views.summary(o, AuthUserType.USER)),
      total,
      page,
    );
  }

  async detail(owner: CartOwner, orderId: number) {
    this.requireOwner(owner);
    const order = await this.views.load(orderId);
    if (!order || !this.owns(owner, order)) throw new NotFoundException('Order not found');
    return this.views.full(order, AuthUserType.USER);
  }

  /** A guest without a session looks an order up by its number and the phone it was placed with. */
  async track(orderNumber: string, phone: string) {
    const order = await this.db.order.findOne({ where: { orderNumber: orderNumber.toUpperCase() } });
    const wanted = normalizePhone(phone);
    if (!order || !wanted || normalizePhone(order.recipientPhone) !== wanted) {
      throw new NotFoundException('No order matches that number and phone');
    }
    return this.views.detailById(order.id);
  }

  async cancel(owner: CartOwner, orderId: number, reason?: string) {
    this.requireOwner(owner);
    const actor = await this.actor(owner, orderId);
    await this.status.change(orderId, OrderStatus.CANCELLED, actor, {
      note: reason ?? 'Cancelled by the customer',
      scope: owner.userId ? { userId: owner.userId } : { guestSessionId: owner.sessionId! },
    });
    return this.detail(owner, orderId);
  }

  private async actor(owner: CartOwner, orderId: number) {
    if (owner.userId) {
      const user = await this.db.user.findOne({ where: { id: owner.userId }, select: { id: true, name: true } });
      return { id: owner.userId, type: AuthUserType.USER, name: user?.name ?? 'Customer' };
    }
    const order = await this.db.order.findOne({
      where: { id: orderId, guestSessionId: owner.sessionId! },
      select: { id: true, recipientName: true },
    });
    return { id: null, type: AuthUserType.USER, name: order?.recipientName ?? 'Guest' };
  }

  private owns(owner: CartOwner, order: { userId: number | null; guestSessionId: string | null }) {
    return owner.userId ? order.userId === owner.userId : order.guestSessionId === owner.sessionId;
  }

  private requireOwner(owner: CartOwner) {
    if (!owner.userId && !owner.sessionId) {
      throw new BadRequestException('Guests must send the x-cart-session header to see their orders');
    }
  }
}
