import { Check, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { RefundKind, RefundStatus } from '../../enums/refund-status.enum';
import { Order } from './order.entity';
import { OrderRefundStatusHistory } from './order-refund-status-history.entity';
import { DEFAULT_CURRENCY } from '../../enums/currency';

export interface RefundProof {
  kind: 'image' | 'file';
  fileName: string;
  fileUrl: string;
  filePath: string;
  mimeType: string;
  size: number;
}

// One attempt to give a buyer their money back: for a cancelled order, or (admin) for a returned item.
// An order can have several: if a seller says "refunded" and the buyer says "not received", an admin adds another.
@Entity()
@Check('CHK_order_refund_status', `"status" IN ('needs_to_refund','processing','refunded','voided')`)
@Check('CHK_order_refund_kind', `"kind" IN ('cancelled_order','return')`)
@Index('IDX_order_refund_order', ['orderId'])
@Index('IDX_order_refund_seller_status', ['sellerId', 'status'])
export class OrderRefund extends BaseEntity {
  // ISO 4217 code of every amount on this row.
  @Column({ type: 'char', length: 3, default: DEFAULT_CURRENCY })
  currency: string;

  @Column()
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId', foreignKeyConstraintName: 'FK_order_refund_order' })
  order: Order;

  @Column()
  sellerId: number;

  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @Column({ type: 'varchar', length: 20, default: RefundKind.CANCELLED_ORDER })
  kind: RefundKind;

  // For a return: the return this money is for.
  @Column({ type: 'int', nullable: true })
  orderReturnId: number | null;

  @Column({ type: 'varchar', length: 20, default: RefundStatus.NEEDS_TO_REFUND })
  status: RefundStatus;

  // What the buyer paid (cancelled order) or what the return refunds. The amount given must match it.
  @Column({ type: 'double precision' })
  expectedAmount: number;

  // What was sent back, once it is refunded.
  @Column({ type: 'double precision', nullable: true })
  amount: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  transactionId: string | null;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  proof: RefundProof[];

  @Column({ type: 'timestamptz', nullable: true })
  refundedAt: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  refundedByName: string | null;

  @OneToMany(() => OrderRefundStatusHistory, (h) => h.refund)
  history: OrderRefundStatusHistory[];
}
