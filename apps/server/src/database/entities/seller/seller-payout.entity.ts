import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Seller } from './seller.entity';
import { PayoutStatus } from '../../enums/payout-status.enum';

@Entity()
export class SellerPayout extends BaseEntity {
  @Index()
  @Column()
  sellerId: number;

  @ManyToOne(() => Seller, (seller) => seller.payouts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId' })
  seller: Seller;

  @Column({ type: 'date' })
  periodStart: string;

  @Column({ type: 'date' })
  periodEnd: string;

  @Column({
    type: 'double precision',
  })
  grossAmount: number;

  @Column({
    type: 'double precision',
  })
  commissionAmount: number;

  @Column({
    type: 'double precision',
  })
  netAmount: number;

  @Index()
  @Column({ type: 'varchar', default: PayoutStatus.PENDING })
  status: PayoutStatus;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;
}
