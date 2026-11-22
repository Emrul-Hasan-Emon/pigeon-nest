import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Order } from '../order/order.entity';
import { User } from '../person/user.entity';
import { Seller } from '../seller/seller.entity';
import { ReturnScope } from '../../enums/return-scope.enum';
import { ReturnStatus } from '../../enums/return-status.enum';
import { OrderReturnAttachment } from './order-return-attachment.entity';
import { OrderReturnItem } from './order-return-item.entity';
import { OrderReturnStatusHistory } from './order-return-status-history.entity';

// A request to send back a whole order or some of its items. A customer gets
// one request per order or item for good; an admin can open more while the
// goods are still not returned.
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

  // Empty for a guest order, which cannot be returned by the customer.
  @Index()
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn()
  user: User | null;

  @Index('IDX_order_return_sellerId')
  @Column({ type: 'int' })
  sellerId: number;

  @ManyToOne(() => Seller, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerId', foreignKeyConstraintName: 'FK_order_return_sellerId' })
  seller: Seller;

  @Index()
  @Column({ type: 'varchar', length: 30 })
  status: ReturnStatus;

  @Column({ type: 'varchar', length: 20 })
  scope: ReturnScope;

  @Column({ type: 'text' })
  reason: string;

  // Full-order returns only: whether the delivery charge is paid back too.
  // Starts from the platform setting; the seller (on accept) or an admin decides.
  @Column({ type: 'boolean', default: false })
  includeDeliveryCharge: boolean;

  // refundAmount = itemsAmount + deliveryAmount
  @Column({ type: 'double precision', default: 0 })
  itemsAmount: number;

  @Column({ type: 'double precision', default: 0 })
  deliveryAmount: number;

  @Column({ type: 'double precision' })
  refundAmount: number;

  // The commission that comes back off the seller's balance when this return is `returned`.
  @Column({ type: 'double precision', default: 0 })
  commissionAmount: number;

  @Column({ type: 'timestamptz', nullable: true })
  returnedAt: Date | null;

  @OneToMany(() => OrderReturnItem, (item) => item.orderReturn)
  items: OrderReturnItem[];

  @OneToMany(() => OrderReturnStatusHistory, (history) => history.orderReturn)
  statusHistory: OrderReturnStatusHistory[];

  @OneToMany(() => OrderReturnAttachment, (a) => a.orderReturn)
  attachments: OrderReturnAttachment[];
}
