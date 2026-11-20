import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Relation,
} from 'typeorm';
import { BaseEntity } from '../base.entity';
import { User } from '../person/user.entity';
import { Seller } from '../seller/seller.entity';
import { CartItem } from './cart-item.entity';
import { Order } from '../order/order.entity';

// One active cart per owner (customer or guest session) and seller.
@Entity()
@Index('UQ_cart_active_user_seller', ['userId', 'sellerId'], {
  unique: true,
  where: '"isActive" = true AND "userId" IS NOT NULL AND "deletedAt" IS NULL',
})
@Index('UQ_cart_active_session_seller', ['sessionId', 'sellerId'], {
  unique: true,
  where: '"isActive" = true AND "sessionId" IS NOT NULL AND "deletedAt" IS NULL',
})
export class Cart extends BaseEntity {
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column()
  sellerId: number;

  @ManyToOne(() => Seller, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId' })
  seller: Seller;

  @Column({
    type: 'double precision',
    default: 0,
  })
  totalPrice: number;

  @Column({
    type: 'double precision',
    default: 0,
  })
  totalDiscountedPrice: number;

  @Index()
  @Column({ nullable: true })
  sessionId: string;

  // Turns false when the cart becomes an order; the cart itself is kept.
  @Index('IDX_cart_isActive')
  @Column({ default: true })
  isActive: boolean;

  // The order this cart was checked out into.
  @Index('IDX_cart_orderId')
  @Column({ type: 'int', nullable: true })
  orderId: number | null;

  @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'orderId', foreignKeyConstraintName: 'FK_cart_orderId' })
  order: Relation<Order> | null;

  @OneToMany(() => CartItem, (item) => item.cart)
  items: CartItem[];
}
