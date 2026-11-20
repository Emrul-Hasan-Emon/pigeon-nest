import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Order } from './order.entity';
import { OrderStatus } from '../../enums/order-status.enum';

@Entity()
export class OrderStatusHistory extends BaseEntity {
  @Index()
  @Column()
  orderId: number;

  @ManyToOne(() => Order, (order) => order.statusHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  order: Order;

  // Null for the first entry, when the order was placed.
  @Column({ type: 'varchar', nullable: true })
  fromStatus: OrderStatus | null;

  // The status the order moved to. Who moved it is in the creator columns.
  @Column({ type: 'varchar' })
  status: OrderStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
