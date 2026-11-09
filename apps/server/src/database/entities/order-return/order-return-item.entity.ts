import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { OrderReturn } from './order-return.entity';
import { OrderItem } from '../order/order-item.entity';

@Entity()
export class OrderReturnItem extends BaseEntity {
  @Index()
  @Column()
  orderReturnId: number;

  @ManyToOne(() => OrderReturn, (orderReturn) => orderReturn.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  orderReturn: OrderReturn;

  @Column()
  orderItemId: number;

  @ManyToOne(() => OrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn()
  orderItem: OrderItem;

  @Column()
  quantity: number;

  @Column({ type: 'text', nullable: true })
  reason: string;
}
