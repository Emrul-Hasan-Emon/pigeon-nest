import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PushService } from '../../push/services/push.service';
import { DatabaseService } from '../../database/database.service';
import { User } from '../../database/entities/person/user.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { OrderStatus } from '../../database/enums/order-status.enum';
import { PaymentClaimStatus } from '../../database/enums/payment-claim.enum';
import { AttachmentFileService } from '../../shared/services/attachment-file.service';
import { moneyGreater, tidy } from '../../shared/utils/money.util';
import { CreatePaymentClaimDto } from '../dtos/payment-claim.dtos';

const FOLDER = 'payment-claims';
/** A customer asks to have a cash-on-delivery order marked as paid, once. */
@Injectable()
export class UserPaymentClaimService {
  constructor(
    private readonly db: DatabaseService,
    private readonly files: AttachmentFileService,
    private readonly push: PushService,
  ) {}

  async create(user: User, orderId: number, dto: CreatePaymentClaimDto, uploads?: Express.Multer.File[]) {
    const order = await this.db.order.findOne({ where: { id: orderId, userId: user.id } });
    if (!order) throw new NotFoundException('Order not found');
    // Only a cash-on-delivery order, and only once the seller has accepted it.
    if (order.paymentGatewaySlug !== 'cash-on-delivery') throw new BadRequestException('You can ask to mark an order as paid only when it is cash on delivery');
    if (order.status === OrderStatus.CANCELLED) throw new ConflictException('This order was cancelled');
    if (order.status === OrderStatus.PENDING) throw new ConflictException('Wait until the seller accepts your order. Then you can send this request.');
    const balance = tidy(order.payableAmount - order.amountPaid);
    if (balance <= 0) throw new ConflictException('This order is already fully paid');
    if (moneyGreater(dto.amount, balance)) throw new BadRequestException(`The amount cannot be more than what is still to pay (${balance})`);
    if (dto.paidOn && new Date(dto.paidOn).getTime() > Date.now() + 24 * 60 * 60 * 1000) throw new BadRequestException('The payment date cannot be in the future');
    // One request per order, whatever became of an earlier one.
    if (await this.db.paymentClaim.exists({ where: { orderId } })) throw new ConflictException('You have already sent a request for this order. Only one request is allowed per order.');
    const list = this.files.validate(uploads);
    if (list.length === 0) throw new BadRequestException('Attach a screenshot or a file that proves your payment');

    const stored = await this.files.store(list, FOLDER);
    try {
      const saved = await this.db.paymentClaim.save({
        orderId,
        sellerId: order.sellerId,
        userId: user.id,
        amount: dto.amount,
        transactionId: dto.transactionId,
        method: dto.method,
        senderNumber: dto.senderNumber ?? null,
        paidOn: dto.paidOn ? dto.paidOn.slice(0, 10) : null,
        note: dto.note ?? null,
        attachments: stored,
        status: PaymentClaimStatus.PENDING,
        createdBy: user.id,
        creatorType: AuthUserType.USER,
        creatorName: user.name,
      });
      this.push.notifySeller(order.sellerId, { title: 'Payment request', body: `${order.orderNumber}: the buyer says they paid ${dto.amount}`, data: { route: '/more/payment-claims' } });
      return { id: saved.id, status: saved.status };
    } catch (e) {
      await this.files.discard(stored);
      // Two requests at the same moment: the unique index lets only one through.
      if ((e as { code?: string }).code === '23505') throw new ConflictException('You have already sent a request for this order. Only one request is allowed per order.');
      throw e;
    }
  }
}
