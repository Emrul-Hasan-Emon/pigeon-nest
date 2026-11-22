import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { OrderReturn } from './order-return.entity';
import { OrderItem } from '../order/order-item.entity';

// One order line inside a return. Money is copied from the line when the
// return is opened, so later edits never change what was agreed.
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

  @Index('IDX_order_return_item_orderItemId')
  @Column()
  orderItemId: number;

  @ManyToOne(() => OrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn()
  orderItem: OrderItem;

  // The whole line comes back, so this is the ordered quantity.
  @Column()
  quantity: number;

  // What the customer paid for the line.
  @Column({ type: 'double precision', default: 0 })
  refundAmount: number;

  // The line's commission, taken back when the return is `returned`.
  @Column({ type: 'double precision', default: 0 })
  commissionAmount: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;
}
