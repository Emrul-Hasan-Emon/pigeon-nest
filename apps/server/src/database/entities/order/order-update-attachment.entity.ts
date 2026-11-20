import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { OrderUpdate } from './order-update.entity';

@Entity('order_update_attachments')
export class OrderUpdateAttachment extends BaseEntity {
  @Index('IDX_order_update_attachments_updateId')
  @Column()
  orderUpdateId: number;

  @ManyToOne(() => OrderUpdate, (u) => u.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderUpdateId', foreignKeyConstraintName: 'FK_order_update_attachments_updateId' })
  update: OrderUpdate;

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
