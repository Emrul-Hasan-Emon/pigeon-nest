import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Seller } from './seller.entity';
import { PayoutStatus } from '../../enums/payout-status.enum';
import { decimalTransformer } from '../../utils/decimal.transformer';

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
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  grossAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  commissionAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  netAmount: number;

  @Index()
  @Column({ type: 'varchar', default: PayoutStatus.PENDING })
  status: PayoutStatus;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;
}
