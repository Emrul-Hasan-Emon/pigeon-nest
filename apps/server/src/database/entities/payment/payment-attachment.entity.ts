import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Order } from '../order/order.entity';
import { Payment } from './payment.entity';

// A file that proves a payment: a receipt photo, a bank slip, a PDF. One
// payment can have several, so they live in their own table.
@Entity('payment_attachments')
export class PaymentAttachment extends BaseEntity {
  @Index('IDX_payment_attachments_paymentId')
  @Column()
  paymentId: number;

  @ManyToOne(() => Payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paymentId', foreignKeyConstraintName: 'FK_payment_attachments_paymentId' })
  payment: Payment;

  @Index('IDX_payment_attachments_orderId')
  @Column()
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId', foreignKeyConstraintName: 'FK_payment_attachments_orderId' })
  order: Order;

  // image or file
  @Column({ type: 'varchar', length: 10 })
  kind: 'image' | 'file';

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 1000 })
  fileUrl: string;

  @Column({ type: 'varchar', length: 1000 })
  filePath: string;

  @Column({ type: 'varchar', length: 150 })
  mimeType: string;

  @Column({ type: 'int' })
  size: number;
}
