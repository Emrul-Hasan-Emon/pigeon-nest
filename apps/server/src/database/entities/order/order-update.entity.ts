import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Order } from './order.entity';
import { OrderUpdateAttachment } from './order-update-attachment.entity';

// A message from the seller or admin about an order: text, files, or both.
// The customer, the seller and the admin all see it in the order details.
@Entity()
export class OrderUpdate extends BaseEntity {
  @Index('IDX_order_update_orderId')
  @Column()
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId', foreignKeyConstraintName: 'FK_order_update_orderId' })
  order: Order;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @OneToMany(() => OrderUpdateAttachment, (a) => a.update)
  attachments: OrderUpdateAttachment[];
}
