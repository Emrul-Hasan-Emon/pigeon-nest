import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
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
import { decimalTransformer } from '../../utils/decimal.transformer';
import { OrderItem } from './order-item.entity';
import { OrderStatusHistory } from './order-status-history.entity';

@Entity()
export class Order extends BaseEntity {
  @Column({ unique: true })
  orderNumber: string;

  @Index()
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

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

  @Column({ nullable: true })
  couponCode: string;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  total: number; // Summation of all order items totalPrice

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  subtotal: number; // Summation of all order items totalDiscountedPrice

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  deliveryCharge: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  discountAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  payableAmount: number; // subtotal + deliveryCharge - discountAmount

  @Index()
  @Column()
  paymentGatewayId: number;

  @ManyToOne(() => PaymentGateway, { onDelete: 'RESTRICT' })
  @JoinColumn()
  paymentGateway: PaymentGateway;

  @Column()
  paymentGatewaySlug: string;

  @Index()
  @Column({ type: 'varchar', length: 255, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'varchar', length: 255 })
  recipientName: string;

  @Column({ type: 'varchar', length: 20 })
  recipientPhone: string;

  @Column({ type: 'text' })
  deliveryAddress: string;

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

  @Column({ nullable: true })
  zipCode: string;

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];

  @OneToMany(() => OrderStatusHistory, (history) => history.order)
  statusHistory: OrderStatusHistory[];
}
