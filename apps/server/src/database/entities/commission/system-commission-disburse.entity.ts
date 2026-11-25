import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Seller } from '../seller/seller.entity';
import { SystemCommissionDisburseAttachment } from './system-commission-disburse-attachment.entity';
import { DEFAULT_CURRENCY } from '../../enums/currency';

// A commission payment the seller made to the platform, recorded by an admin.
@Entity('system_commission_disburse')
export class SystemCommissionDisburse extends BaseEntity {
  // ISO 4217 code of every amount on this row.
  @Column({ type: 'char', length: 3, default: DEFAULT_CURRENCY })
  currency: string;

  @Index('IDX_system_commission_disburse_sellerId')
  @Column()
  sellerId: number;

  @ManyToOne(() => Seller, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerId', foreignKeyConstraintName: 'FK_system_commission_disburse_sellerId' })
  seller: Seller;

  // Received from the seller now.
  @Column({ type: 'double precision' })
  amount: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // The balance right after this payment.
  @Column({ type: 'double precision' })
  totalAmount: number;

  @Column({ type: 'double precision' })
  dueAmount: number;

  @Column({ type: 'double precision' })
  paidAmount: number;

  @OneToMany(() => SystemCommissionDisburseAttachment, (a) => a.disburse)
  attachments: SystemCommissionDisburseAttachment[];
}
