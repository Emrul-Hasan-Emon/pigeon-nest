import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { DatabaseService } from '../../database/database.service';
import { Order } from '../../database/entities/order/order.entity';
import { PaymentAttachment } from '../../database/entities/payment/payment-attachment.entity';
import { PaymentStatusHistory } from '../../database/entities/payment/payment-status-history.entity';
import { Payment } from '../../database/entities/payment/payment.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { OrderStatus } from '../../database/enums/order-status.enum';
import { PaymentStatus } from '../../database/enums/payment-status.enum';
import { RecordPaymentDto, ReversePaymentDto } from '../dtos/order-staff.dtos';
import { CommissionService } from '../../commission/services/commission.service';
import { OrderFileService } from './order-file.service';
import { OrderScope, StatusActor } from './order-status.service';
import { moneyGreater, tidy } from '../../shared/utils/money.util';

const round2 = tidy;
const FOLDER = 'order-payments';

/**
 * Staff mark an order paid, in full or in part. The customer may have paid
 * outside the site, so proof is required: a description and at least one file.
 */
@Injectable()
export class OrderPaymentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly files: OrderFileService,
    private readonly commission: CommissionService,
  ) {}

  async record(
    orderId: number,
    dto: RecordPaymentDto,
    uploads: Express.Multer.File[] | undefined,
    actor: StatusActor,
    scope: OrderScope = {},
  ) {
    const list = this.files.validate(uploads);
    if (list.length === 0) {
      throw new BadRequestException('Attach at least one image or file as proof of payment');
    }
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    if (paidAt.getTime() > Date.now() + 5 * 60 * 1000) {
      throw new BadRequestException('paidAt cannot be in the future');
    }

    // Fail early, before storing any file, when the order cannot take a payment.
    const probe = await this.db.order.findOne({
      where: { id: orderId, ...(scope.sellerId !== undefined ? { sellerId: scope.sellerId } : {}) },
    });
    if (!probe) throw new NotFoundException('Order not found');

    const stored = await this.files.store(list, FOLDER);
    try {
      const paymentId = await this.db.order.manager.transaction(async (manager) => {
        const qb = manager
          .createQueryBuilder(Order, 'o')
          .setLock('pessimistic_write')
          .where('o.id = :orderId', { orderId });
        if (scope.sellerId !== undefined) qb.andWhere('o.sellerId = :sellerId', { sellerId: scope.sellerId });
        const order = await qb.getOne();
        if (!order) throw new NotFoundException('Order not found');
        if (order.status === OrderStatus.CANCELLED) {
          throw new ConflictException('A cancelled order cannot take a payment');
        }
        const balance = round2(order.payableAmount - order.amountPaid);
        if (balance <= 0) throw new ConflictException('This order is already fully paid');
        const amount = dto.amount ?? balance;
        if (moneyGreater(amount, balance)) {
          throw new BadRequestException(`amount cannot be more than the balance due (${balance})`);
        }

        const paidTotal = round2(order.amountPaid + amount);
        const status = paidTotal >= order.payableAmount ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;
        const stamp = { updatedBy: actor.id, updaterType: actor.type, updaterName: actor.name };

        // The row made at checkout (status due) becomes the first receipt.
        const open = await manager.findOne(Payment, {
          where: { orderId, status: PaymentStatus.DUE, reversedAt: IsNull() },
          order: { id: 'ASC' },
        });
        let payment: Payment;
        if (open) {
          await manager.update(Payment, open.id, {
            ...stamp,
            status,
            amount,
            paidAt,
            description: dto.description,
            transactionId: dto.transactionId ?? open.transactionId,
          });
          payment = { ...open, status, amount };
        } else {
          payment = await manager.save(Payment, {
            createdBy: actor.id,
            creatorType: actor.type,
            creatorName: actor.name,
            orderId,
            userId: order.userId,
            paymentGatewayId: order.paymentGatewayId,
            paymentGatewayName: order.paymentGatewayName,
            paymentGatewaySlug: order.paymentGatewaySlug,
            status,
            amount,
            paidAt,
            description: dto.description,
            transactionId: dto.transactionId ?? null,
          });
        }

        await manager.save(
          PaymentAttachment,
          stored.map((s) => ({
            ...s,
            paymentId: payment.id,
            orderId,
            createdBy: actor.id,
            creatorType: actor.type,
            creatorName: actor.name,
          })),
        );
        await manager.update(Order, orderId, { ...stamp, amountPaid: paidTotal, paymentStatus: status });
        await manager.save(PaymentStatusHistory, {
          orderId,
          paymentId: payment.id,
          fromStatus: order.paymentStatus,
          status,
          amount,
          amountPaidAfter: paidTotal,
          note: dto.description,
          createdBy: actor.id,
          creatorType: actor.type,
          creatorName: actor.name,
        });
        // Fully paid: the platform's commission on this order is now earned.
        if (status === PaymentStatus.PAID) await this.commission.earnFromOrder(manager, order, actor);
        return payment.id;
      });
      return { orderId, paymentId };
    } catch (error) {
      await this.files.discard(stored);
      throw error;
    }
  }

  /**
   * Undo one recorded payment (it never arrived, or was entered by mistake).
   * The row is kept with who reversed it and why, the order's total received
   * goes down, its payment status follows, and the history gets a line. A seller
   * can only undo a payment a seller recorded; an admin can undo any.
   */
  async reverse(
    orderId: number,
    paymentId: number,
    dto: ReversePaymentDto,
    actor: StatusActor,
    scope: OrderScope = {},
  ) {
    return this.db.order.manager.transaction(async (manager) => {
      const qb = manager
        .createQueryBuilder(Order, 'o')
        .setLock('pessimistic_write')
        .where('o.id = :orderId', { orderId });
      if (scope.sellerId !== undefined) qb.andWhere('o.sellerId = :sellerId', { sellerId: scope.sellerId });
      const order = await qb.getOne();
      if (!order) throw new NotFoundException('Order not found');

      const payment = await manager.findOne(Payment, { where: { id: paymentId, orderId } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.reversedAt) throw new ConflictException('This payment was already reversed');
      if (payment.status === PaymentStatus.DUE) {
        throw new ConflictException('This payment has not been received, so there is nothing to reverse');
      }
      const recordedBy = payment.updaterType ?? payment.creatorType;
      if (actor.type === AuthUserType.SELLER && recordedBy !== AuthUserType.SELLER) {
        throw new ForbiddenException('Only an admin can reverse a payment an admin recorded');
      }

      const received = payment.amount;
      const paidTotal = Math.max(0, round2(order.amountPaid - received));
      const status =
        paidTotal <= 0 ? PaymentStatus.DUE : paidTotal >= order.payableAmount ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;

      await manager.update(Payment, payment.id, {
        status: PaymentStatus.DUE,
        reversedAt: new Date(),
        reversedBy: actor.id,
        reversedByType: actor.type,
        reversedByName: actor.name,
        reversalReason: dto.reason,
        updatedBy: actor.id,
        updaterType: actor.type,
        updaterName: actor.name,
      });
      await manager.update(Order, orderId, {
        amountPaid: paidTotal,
        paymentStatus: status,
        updatedBy: actor.id,
        updaterType: actor.type,
        updaterName: actor.name,
      });
      await manager.save(PaymentStatusHistory, {
        orderId,
        paymentId: payment.id,
        fromStatus: order.paymentStatus,
        status,
        amount: -received,
        amountPaidAfter: paidTotal,
        note: `Payment #${payment.id} reversed: ${dto.reason}`,
        createdBy: actor.id,
        creatorType: actor.type,
        creatorName: actor.name,
      });
      // No longer fully paid: take the commission back out.
      if (order.paymentStatus === PaymentStatus.PAID && status !== PaymentStatus.PAID) {
        await this.commission.revokeFromOrder(manager, order, `Payment #${payment.id} reversed: ${dto.reason}`, actor);
      }
      return { orderId, paymentId: payment.id, paymentStatus: status, amountPaid: paidTotal };
    });
  }
}
