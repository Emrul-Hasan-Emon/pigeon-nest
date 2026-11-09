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

  @Column({ type: 'varchar' })
  status: OrderStatus;

  @Column({ type: 'text', nullable: true })
  note: string;
}
