import { Column, Entity, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { SellerStatus } from '../../enums/seller-status.enum';
import { SellerActiveStatus } from '../../enums/seller-active-status.enum';
import { Shop } from '../shop/shop.entity';
import { SellerProduct } from '../product/seller-product.entity';
import { SellerPayout } from './seller-payout.entity';
import { SellerStatusChangeHistory } from './seller-status-change-history.entity';

@Entity()
export class Seller extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ unique: true, nullable: true })
  phone: string;

  @Column()
  passwordHash: string;

  // Selling switch. On (the default): the seller and their products are shown. Off: hidden from buyers everywhere.
  @Column({ default: true })
  isEnabledForSell: boolean;

  // A planned break: hidden from the first day to the last day, both included. Set both or neither.
  @Column({ type: 'date', nullable: true })
  breakStartsOn: string | null;

  @Column({ type: 'date', nullable: true })
  breakEndsOn: string | null;

  // A short message for the seller's own records (shown to the seller, not to buyers).
  @Column({ type: 'varchar', length: 300, nullable: true })
  breakNote: string | null;

  // Short "about us" text, shown on the public seller page.
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  avatarPath: string;

  @Column({ nullable: true })
  nidFrontImageUrl: string;

  @Column({ nullable: true })
  nidFrontImagePath: string;

  @Column({ nullable: true })
  nidBackImageUrl: string;

  @Column({ nullable: true })
  nidBackImagePath: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ default: false })
  phoneVerified: boolean;

  @Column({ type: 'varchar', default: SellerStatus.PENDING })
  status: SellerStatus;

  @Column({ type: 'jsonb', nullable: true })
  payoutAccountInfo: Record<string, unknown> | null;

  // Set by admin only. Self-registered sellers start inactive.
  @Column({ type: 'varchar', default: SellerActiveStatus.INACTIVE })
  activeStatus: SellerActiveStatus;

  // Why an admin rejected the seller; cleared when the seller resubmits.
  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @OneToOne(() => Shop, (shop) => shop.seller)
  shop: Shop;

  @OneToMany(() => SellerProduct, (product) => product.seller)
  products: SellerProduct[];

  @OneToMany(() => SellerPayout, (payout) => payout.seller)
  payouts: SellerPayout[];

  @OneToMany(() => SellerStatusChangeHistory, (entry) => entry.seller)
  statusHistory: SellerStatusChangeHistory[];
}
