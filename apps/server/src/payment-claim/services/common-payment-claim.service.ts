import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PaymentClaim } from '../../database/entities/payment/payment-claim.entity';
import { maskName } from '../../shared/utils/mask-name.util';

type Row = PaymentClaim & { order?: { id: number; orderNumber: string; payableAmount: number; amountPaid: number } | null; user?: { name: string } | null };

/** How a claim is shown to the shop and to staff. */
@Injectable()
export class CommonPaymentClaimService {
  constructor(private readonly db: DatabaseService) {}

  staffView(c: Row) {
    return {
      id: c.id,
      order: c.order ? { id: c.order.id, orderNumber: c.order.orderNumber, payable: c.order.payableAmount, paid: c.order.amountPaid } : { id: c.orderId, orderNumber: '', payable: 0, paid: 0 },
      buyerName: maskName(c.user?.name),
      amount: c.amount,
      transactionId: c.transactionId,
      method: c.method,
      senderNumber: c.senderNumber,
      paidOn: c.paidOn,
      note: c.note,
      attachments: (c.attachments ?? []).map((a) => ({ kind: a.kind, fileName: a.fileName, fileUrl: a.fileUrl })),
      status: c.status,
      decisionNote: c.decisionNote,
      decidedAt: c.decidedAt,
      decidedByName: c.decidedByName,
      paymentId: c.paymentId,
      createdAt: c.createdAt,
    };
  }

  withRelations() {
    return this.db.paymentClaim
      .createQueryBuilder('c')
      .leftJoin('c.order', 'o')
      .leftJoin('c.user', 'u')
      .addSelect(['o.id', 'o.orderNumber', 'o.payableAmount', 'o.amountPaid', 'u.id', 'u.name'])
      .where('c.deletedAt IS NULL');
  }
}
