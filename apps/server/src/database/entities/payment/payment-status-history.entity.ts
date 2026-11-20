import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Order } from '../order/order.entity';
import { Payment } from './payment.entity';
import { PaymentStatus } from '../../enums/payment-status.enum';

// Every time an order's payment status changes: who, when, and how much came in.
@Entity()
export class PaymentStatusHistory extends BaseEntity {
  @Index('IDX_payment_status_history_orderId')
  @Column()
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId', foreignKeyConstraintName: 'FK_payment_status_history_orderId' })
  order: Order;

  @Column({ type: 'int', nullable: true })
  paymentId: number | null;

  @ManyToOne(() => Payment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'paymentId', foreignKeyConstraintName: 'FK_payment_status_history_paymentId' })
  payment: Payment | null;

  @Column({ type: 'varchar', nullable: true })
  fromStatus: PaymentStatus | null;

  @Column({ type: 'varchar' })
  status: PaymentStatus;

  // The amount received with this change (0 when the order was placed).
  @Column({ type: 'double precision', default: 0 })
  amount: number;

  // What the order had received in total after this change.
  @Column({ type: 'double precision', default: 0 })
  amountPaidAfter: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
