import { Column, Entity, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { SellerStatus } from '../../enums/seller-status.enum';
import { decimalTransformer } from '../../utils/decimal.transformer';
import { Shop } from '../shop/shop.entity';
import { SellerProduct } from '../product/seller-product.entity';
import { SellerPayout } from './seller-payout.entity';

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

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  avatarPath: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ default: false })
  phoneVerified: boolean;

  @Column({ type: 'varchar', default: SellerStatus.PENDING })
  status: SellerStatus;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  commissionRate: number;

  @Column({ type: 'jsonb', nullable: true })
  payoutAccountInfo: Record<string, unknown> | null;

  @Column({ default: true })
  isActive: boolean;

  @OneToOne(() => Shop, (shop) => shop.seller)
  shop: Shop;

  @OneToMany(() => SellerProduct, (product) => product.seller)
  products: SellerProduct[];

  @OneToMany(() => SellerPayout, (payout) => payout.seller)
  payouts: SellerPayout[];
}
