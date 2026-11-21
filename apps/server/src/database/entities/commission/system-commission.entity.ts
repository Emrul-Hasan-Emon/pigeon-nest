import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Seller } from '../seller/seller.entity';

// The running commission balance of one seller. Changed only inside the
// commission service, under a row lock, so total = due + paid always holds.
@Entity('system_commission')
export class SystemCommission extends BaseEntity {
  @Column({ unique: true })
  sellerId: number;

  @ManyToOne(() => Seller, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerId', foreignKeyConstraintName: 'FK_system_commission_sellerId' })
  seller: Seller;

  // Everything earned from the seller's paid orders.
  @Column({ type: 'double precision', default: 0 })
  totalCommission: number;

  // Earned but not yet handed over. Below zero means the platform owes the seller.
  @Column({ type: 'double precision', default: 0 })
  dueCommission: number;

  // Handed over to the platform so far.
  @Column({ type: 'double precision', default: 0 })
  paidCommission: number;
}
