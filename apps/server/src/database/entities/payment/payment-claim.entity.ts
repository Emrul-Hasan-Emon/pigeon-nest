import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Order } from '../order/order.entity';
import { User } from '../person/user.entity';
import { PaymentClaimStatus } from '../../enums/payment-claim.enum';
import { DEFAULT_CURRENCY } from '../../enums/currency';

export interface ClaimAttachment {
  kind: 'image' | 'file';
  fileName: string;
  fileUrl: string;
  filePath: string;
  mimeType: string;
  size: number;
}

// A "mark as paid" request: for a cash-on-delivery order the seller has accepted, the buyer says they have already
// paid and sends proof. One request per order, ever. The seller or admin accepts it (the order is marked paid and the
// claim keeps a link to that payment) or rejects it (the buyer cannot ask again).
@Entity()
@Check('CHK_payment_claim_status', `"status" IN ('pending','confirmed','rejected','cancelled')`)
@Index('UQ_payment_claim_order', ['orderId'], { unique: true, where: '"deletedAt" IS NULL' })
@Index('IDX_payment_claim_seller_status', ['sellerId', 'status'])
export class PaymentClaim extends BaseEntity {
  // ISO 4217 code of every amount on this row.
  @Column({ type: 'char', length: 3, default: DEFAULT_CURRENCY })
  currency: string;

  @Column()
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId', foreignKeyConstraintName: 'FK_payment_claim_order' })
  order: Order;

  @Column()
  sellerId: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_payment_claim_user' })
  user: User;

  @Column({ type: 'double precision' })
  amount: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  transactionId: string | null;

  // PayPal, Wise, bank transfer...
  @Column({ type: 'varchar', length: 60, nullable: true })
  method: string | null;

  // The number or account the money was sent from.
  @Column({ type: 'varchar', length: 40, nullable: true })
  senderNumber: string | null;

  @Column({ type: 'date', nullable: true })
  paidOn: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  attachments: ClaimAttachment[];

  @Column({ type: 'varchar', length: 20, default: PaymentClaimStatus.PENDING })
  status: PaymentClaimStatus;

  @Column({ type: 'text', nullable: true })
  decisionNote: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  decidedByName: string | null;

  // The payment recorded when the claim was confirmed.
  @Column({ type: 'int', nullable: true })
  paymentId: number | null;
}
