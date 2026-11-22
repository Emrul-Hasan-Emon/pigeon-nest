import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../base.entity';
import { SellerProduct } from './seller-product.entity';
import { SellerProductSkuVariant } from './seller-product-sku-variant.entity';
import { DiscountType } from '../../enums/discount-type.enum';

@Entity()
export class SellerProductSku extends BaseEntity {
  @Index()
  @Column()
  sellerProductId: number;

  @ManyToOne(() => SellerProduct, (product) => product.skus, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sellerProductId' })
  product: SellerProduct;

  @Column({ nullable: true })
  sku: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ nullable: true })
  imagePath: string;

  @Column({ default: 0 })
  quantity: number;

  @Column({ default: 5 })
  lowStockThreshold: number;

  @Column({
    type: 'double precision',
    nullable: true,
  })
  myBuyingPrice: number | null;

  @Column({
    type: 'double precision',
  })
  price: number;

  @Column({
    type: 'double precision',
    nullable: true,
  })
  discountedPrice: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  discountedPriceStartDate: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  discountedPriceEndDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  discountType: DiscountType | null;

  @Column({
    type: 'double precision',
    nullable: true,
  })
  discountValue: number | null;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ default: true })
  isActive: boolean;

  // Buyers may propose their own price for this SKU only when this is on.
  @Column({ default: false })
  acceptProposals: boolean;

  // Hidden from buyers. A proposal below it is rejected on the spot.
  @Column({ type: 'double precision', nullable: true })
  minProposalPrice: number | null;

  @OneToMany(() => SellerProductSkuVariant, (variant) => variant.sku)
  variants: SellerProductSkuVariant[];
}
