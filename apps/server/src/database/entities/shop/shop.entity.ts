import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Seller } from '../seller/seller.entity';

@Entity()
export class Shop extends BaseEntity {
  @Column({ unique: true })
  sellerId: number;

  @OneToOne(() => Seller, (seller) => seller.shop, { onDelete: 'CASCADE' })
  @JoinColumn()
  seller: Seller;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ nullable: true })
  logoPath: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;
}
