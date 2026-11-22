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
import { Division } from '../zone/division.entity';
import { District } from '../zone/district.entity';
import { Area } from '../zone/area.entity';
import { PaymentGateway } from '../payment/payment-gateway.entity';
import { OrderStatus } from '../../enums/order-status.enum';
import { DeliveryType } from '../../enums/delivery-type.enum';
import { PaymentStatus } from '../../enums/payment-status.enum';
import { CommissionType } from '../../enums/commission-type.enum';
import { OrderItem } from './order-item.entity';
import { Cart } from '../cart/cart.entity';
import { OrderStatusHistory } from './order-status-history.entity';

@Entity()
export class Order extends BaseEntity {
  @Column({ unique: true })
  orderNumber: string;

  // The cart this order was checked out from (empty for orders staff create).
  @Index('IDX_order_cartId')
  @Column({ type: 'int', nullable: true })
  cartId: number | null;

  @ManyToOne(() => Cart, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cartId', foreignKeyConstraintName: 'FK_order_cartId' })
  cart: Relation<Cart> | null;

  // Empty for a guest order; the guest is then known by guestSessionId.
  @Index()
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Index('IDX_order_guestSessionId')
  @Column({ type: 'varchar', length: 100, nullable: true })
  guestSessionId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactEmail: string | null;

  @Index()
  @Column()
  sellerId: number;

  @ManyToOne(() => Seller, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerId' })
  seller: Seller;

  @Index()
  @Column({ type: 'varchar', default: OrderStatus.PENDING })
  status: OrderStatus;

  @Index()
  @Column({ type: 'varchar', default: DeliveryType.STANDARD })
  deliveryType: DeliveryType;

  @Column({ type: 'int', nullable: true })
  couponId: number | null;

  @Column({ type: 'varchar', nullable: true })
  couponCode: string | null;

  @Column({
    type: 'double precision',
  })
  total: number; // Summation of all order items totalPrice

  @Column({
    type: 'double precision',
  })
  subtotal: number; // Summation of what each line is payable at: totalProposalPrice, else totalDiscountedPrice, else totalPrice

  @Column({
    type: 'double precision',
    default: 0,
  })
  deliveryCharge: number;

  @Column({
    type: 'double precision',
    default: 0,
  })
  discountAmount: number;

  @Column({
    type: 'double precision',
  })
  payableAmount: number; // subtotal + deliveryCharge - discountAmount

  // The platform's cut, worked out from `subtotal` when the order was placed
  // with the seller's rate (or the global one). Fixed at placement, so a later
  // rate change never touches an old order.
  @Column({ type: 'double precision', default: 0 })
  systemCommission: number;

  // payableAmount - systemCommission
  @Column({ type: 'double precision', default: 0 })
  sellerAmount: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  commissionType: CommissionType | null;

  // The percentage or fixed amount that was applied.
  @Column({ type: 'double precision', nullable: true })
  commissionValue: number | null;

  @Index()
  @Column()
  paymentGatewayId: number;

  @ManyToOne(() => PaymentGateway, { onDelete: 'RESTRICT' })
  @JoinColumn()
  paymentGateway: PaymentGateway;

  @Column({ type: 'varchar', length: 255 })
  paymentGatewayName: string;

  @Column()
  paymentGatewaySlug: string;

  @Index()
  @Column({ type: 'varchar', default: PaymentStatus.DUE })
  paymentStatus: PaymentStatus;

  // What staff have recorded as received so far.
  @Column({
    type: 'double precision',
    default: 0,
  })
  amountPaid: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 255 })
  recipientName: string;

  @Column({ type: 'varchar', length: 20 })
  recipientPhone: string;

  @Column({ type: 'text' })
  deliveryAddress: string;

  @Index('IDX_order_countryCode')
  @Column({ type: 'varchar', length: 2 })
  countryCode: string;

  @Column({ type: 'varchar', length: 100 })
  countryName: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 120 })
  city: string;

  // Shipping as quoted when the order was placed.
  @Column({ type: 'int', nullable: true })
  deliveryEstimatedDays: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  shippingZoneName: string | null;

  @Column({ type: 'int', nullable: true })
  divisionId: number | null;

  @ManyToOne(() => Division, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'divisionId' })
  division: Division;

  @Column({ type: 'int', nullable: true })
  districtId: number | null;

  @ManyToOne(() => District, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'districtId' })
  district: District;

  @Column({ type: 'int', nullable: true })
  areaId: number | null;

  @ManyToOne(() => Area, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'areaId' })
  area: Area;

  @Column({ type: 'varchar', nullable: true })
  zipCode: string | null;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];

  @OneToMany(() => OrderStatusHistory, (history) => history.order)
  statusHistory: OrderStatusHistory[];
}
