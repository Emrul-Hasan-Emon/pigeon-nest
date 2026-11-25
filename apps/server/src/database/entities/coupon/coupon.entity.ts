import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Seller } from '../seller/seller.entity';
import { CouponType } from '../../enums/coupon-type.enum';
import { DEFAULT_CURRENCY } from '../../enums/currency';

@Entity()
export class Coupon extends BaseEntity {
  // ISO 4217 code of every amount on this row.
  @Column({ type: 'char', length: 3, default: DEFAULT_CURRENCY })
  currency: string;

  @Column({ unique: true })
  code: string;

  @Index()
  @Column({ type: 'int', nullable: true })
  sellerId: number | null;

  @ManyToOne(() => Seller, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'sellerId' })
  seller: Seller | null;

  @Column({ type: 'varchar' })
  type: CouponType;

  @Column({
    type: 'double precision',
  })
  amount: number;

  @Column({
    type: 'double precision',
    default: 0,
  })
  minOrderAmount: number;

  @Column({
    type: 'double precision',
    nullable: true,
  })
  maxDiscountAmount: number | null;

  @Column({ type: 'int', nullable: true })
  usageLimit: number | null;

  @Column({ default: 0 })
  usedCount: number;

  @Column({ type: 'int', nullable: true })
  perUserLimit: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ default: true })
  isActive: boolean;
}
