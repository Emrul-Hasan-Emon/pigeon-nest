import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { OrderReturn } from './order-return.entity';
import { OrderReturnStatusHistory } from './order-return-status-history.entity';

// A photo or file on a return: the customer's evidence, or the seller's refund proof.
@Entity('order_return_attachments')
export class OrderReturnAttachment extends BaseEntity {
  @Index('IDX_order_return_attachments_returnId')
  @Column()
  orderReturnId: number;

  @ManyToOne(() => OrderReturn, (r) => r.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderReturnId', foreignKeyConstraintName: 'FK_order_return_attachments_returnId' })
  orderReturn: OrderReturn;

  // The history row (status move) the file belongs to.
  @Index('IDX_order_return_attachments_historyId')
  @Column({ type: 'int', nullable: true })
  statusHistoryId: number | null;

  @ManyToOne(() => OrderReturnStatusHistory, (h) => h.attachments, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'statusHistoryId', foreignKeyConstraintName: 'FK_order_return_attachments_historyId' })
  statusHistory: OrderReturnStatusHistory | null;

  @Column({ type: 'varchar', length: 10 })
  kind: 'image' | 'file';

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 1000 })
  fileUrl: string;

  @Column({ type: 'varchar', length: 1000 })
  filePath: string;

  @Column({ type: 'varchar', length: 150 })
  mimeType: string;

  @Column({ type: 'int' })
  size: number;
}
