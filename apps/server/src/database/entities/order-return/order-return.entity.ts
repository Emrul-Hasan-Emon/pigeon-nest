import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Order } from '../order/order.entity';
import { User } from '../person/user.entity';
import { OrderReturnItem } from './order-return-item.entity';
import { OrderReturnStatusHistory } from './order-return-status-history.entity';

@Entity()
export class OrderReturn extends BaseEntity {
  @Column({ unique: true })
  returnNumber: string;

  @Index()
  @Column()
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'RESTRICT' })
  @JoinColumn()
  order: Order;

  @Index()
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn()
  user: User;

  @Index()
  @Column()
  status: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'double precision',
  })
  refundAmount: number;

  @Column({ nullable: true })
  refundMethod: string;

  @Column({ type: 'jsonb', nullable: true })
  media: string[] | null;

  @OneToMany(() => OrderReturnItem, (item) => item.orderReturn)
  items: OrderReturnItem[];

  @OneToMany(() => OrderReturnStatusHistory, (history) => history.orderReturn)
  statusHistory: OrderReturnStatusHistory[];
}
