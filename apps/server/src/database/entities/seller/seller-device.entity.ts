import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Seller } from './seller.entity';

// A phone that has the seller app signed in, so the server can send it a push notification.
@Entity()
@Check('CHK_seller_device_platform', `"platform" IN ('android','ios')`)
export class SellerDevice extends BaseEntity {
  @Index('IDX_seller_device_seller')
  @Column()
  sellerId: number;

  @ManyToOne(() => Seller, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId', foreignKeyConstraintName: 'FK_seller_device_seller' })
  seller: Seller;

  // The Firebase Cloud Messaging token of the phone. One phone is one row, whoever is signed in on it.
  @Index('UQ_seller_device_token', { unique: true })
  @Column({ type: 'varchar', length: 512 })
  token: string;

  @Column({ type: 'varchar', length: 10 })
  platform: 'android' | 'ios';

  @Column({ type: 'timestamp', default: () => 'now()' })
  lastSeenAt: Date;
}
