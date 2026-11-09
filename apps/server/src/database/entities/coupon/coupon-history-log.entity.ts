import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Coupon } from './coupon.entity';
import { User } from '../person/user.entity';
import { Order } from '../order/order.entity';
import { decimalTransformer } from '../../utils/decimal.transformer';

@Entity()
export class CouponHistoryLog extends BaseEntity {
  @Index()
  @Column()
  couponId: number;

  @ManyToOne(() => Coupon, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'couponId' })
  coupon: Coupon;

  @Index()
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({ type: 'int', nullable: true })
  orderId: number | null;

  @ManyToOne(() => Order, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Order | null;

  @Column()
  couponCode: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  discountAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  orderTotal: number;
}
