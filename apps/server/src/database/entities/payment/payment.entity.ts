import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Order } from '../order/order.entity';
import { PaymentGateway } from './payment-gateway.entity';
import { PaymentStatus } from '../../enums/payment-status.enum';
import { User } from '../person/user.entity';
import { AuthUserType } from '../../enums/auth-user-type.enum';
import { DEFAULT_CURRENCY } from '../../enums/currency';

@Entity()
export class Payment extends BaseEntity {
  // ISO 4217 code of every amount on this row.
  @Column({ type: 'char', length: 3, default: DEFAULT_CURRENCY })
  currency: string;

  @Index()
  @Column()
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Index('IDX_payment_userId')
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_payment_userId' })
  user: User | null;

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

  // What the customer wrote (or staff wrote when marking it paid).
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index()
  @Column({ type: 'varchar', default: PaymentStatus.DUE })
  status: PaymentStatus;

  @Column({
    type: 'double precision',
  })
  amount: number;

  @Column({ type: 'varchar', nullable: true })
  transactionId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metaData: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  providerResponse: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  // Set when staff reverse a receipt (money that was recorded but did not arrive,
  // or was recorded by mistake). A reversed row is kept as a record; its status
  // goes back to due and it no longer counts towards what the order has received.
  @Column({ type: 'timestamptz', nullable: true })
  reversedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  reversedBy: number | null;

  @Column({ type: 'varchar', nullable: true })
  reversedByType: AuthUserType | null;

  @Column({ type: 'varchar', nullable: true })
  reversedByName: string | null;

  @Column({ type: 'text', nullable: true })
  reversalReason: string | null;
}
