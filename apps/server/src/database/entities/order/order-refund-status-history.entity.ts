import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { RefundStatus } from '../../enums/refund-status.enum';
import type { RefundProof } from './order-refund.entity';
import { OrderRefund } from './order-refund.entity';

// Every move of a refund record, with who made it, the amount and proof given then, and the note.
@Entity()
@Index('IDX_order_refund_history_refund', ['orderRefundId'])
export class OrderRefundStatusHistory extends BaseEntity {
  @Column()
  orderRefundId: number;

  @ManyToOne(() => OrderRefund, (r) => r.history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderRefundId', foreignKeyConstraintName: 'FK_order_refund_history_refund' })
  refund: OrderRefund;

  @Column()
  orderId: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  fromStatus: RefundStatus | null;

  @Column({ type: 'varchar', length: 20 })
  status: RefundStatus;

  @Column({ type: 'double precision', nullable: true })
  amount: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  attachments: RefundProof[];
}
