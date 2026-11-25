import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Seller } from '../seller/seller.entity';
import { PaymentAccountKind } from '../../enums/payment-claim.enum';

// Where a buyer sends money for this seller's orders. Shown to the buyer on the order, and to the admin.
@Entity()
@Check('CHK_seller_payment_account_kind', `"kind" IN ('mfs','bank')`)
export class SellerPaymentAccount extends BaseEntity {
  @Index('IDX_seller_payment_account_seller')
  @Column()
  sellerId: number;

  @ManyToOne(() => Seller, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId', foreignKeyConstraintName: 'FK_seller_payment_account_seller' })
  seller: Seller;

  @Column({ type: 'varchar', length: 10 })
  kind: PaymentAccountKind;

  // "PayPal", "Wise", "Rocket", or the bank's name.
  @Column({ type: 'varchar', length: 80 })
  provider: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  accountName: string | null;

  // The mobile number or the bank account number.
  @Column({ type: 'varchar', length: 60 })
  accountNumber: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  branchName: string | null;

  // For example "Personal: use Send Money".
  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;

  @Column({ default: true })
  isActive: boolean;
}
