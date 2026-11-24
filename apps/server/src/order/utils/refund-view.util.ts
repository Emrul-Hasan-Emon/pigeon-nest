import { OrderRefund } from '../../database/entities/order/order-refund.entity';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';

/** One refund record with its history. The buyer, the seller and the admin all see exactly this. */
export function refundRecordView(r: OrderRefund) {
  return {
    id: r.id,
    kind: r.kind,
    orderReturnId: r.orderReturnId,
    status: r.status,
    expectedAmount: r.expectedAmount,
    amount: r.amount,
    note: r.note,
    transactionId: r.transactionId,
    proof: (r.proof ?? []).map((p) => ({ kind: p.kind, fileName: p.fileName, fileUrl: p.fileUrl })),
    refundedAt: r.refundedAt,
    refundedByName: r.refundedByName,
    createdAt: r.createdAt,
    history: [...(r.history ?? [])]
      .sort((a, b) => a.id - b.id)
      .map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        status: h.status,
        amount: h.amount,
        note: h.note,
        by: h.creatorType === AuthUserType.ADMIN ? 'Admin team' : h.creatorName,
        byType: h.creatorType,
        createdAt: h.createdAt,
        attachments: (h.attachments ?? []).map((p) => ({ kind: p.kind, fileName: p.fileName, fileUrl: p.fileUrl })),
      })),
  };
}
