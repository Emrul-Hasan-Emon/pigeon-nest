import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Order } from '../order/order.entity';
import { PaymentGateway } from './payment-gateway.entity';
import { PaymentStatus } from '../../enums/payment-status.enum';
import { decimalTransformer } from '../../utils/decimal.transformer';
import { User } from '../person/user.entity';

@Entity()
export class Payment extends BaseEntity {
  @Index()
  @Column()
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Index()
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column()
  paymentGatewayId: number;

  @ManyToOne(() => PaymentGateway, { onDelete: 'RESTRICT' })
  @JoinColumn()
  paymentGateway: PaymentGateway;

  @Column()
  paymentGatewaySlug: string;

  @Index()
  @Column({ type: 'varchar', default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number;

  @Column({ nullable: true })
  transactionId: string;

  @Column({ type: 'jsonb', nullable: true })
  metaData: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  providerResponse: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;
}
