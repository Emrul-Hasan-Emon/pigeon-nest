import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Seller } from '../seller/seller.entity';
import { CouponType } from '../../enums/coupon-type.enum';
import { decimalTransformer } from '../../utils/decimal.transformer';

@Entity()
export class Coupon extends BaseEntity {
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
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  minOrderAmount: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
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
