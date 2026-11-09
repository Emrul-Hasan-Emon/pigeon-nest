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
import { decimalTransformer } from '../../utils/decimal.transformer';
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
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  myBuyingPrice: number | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  price: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  discountedPrice: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  discountedPriceStartDate: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  discountedPriceEndDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  discountType: DiscountType | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  discountValue: number | null;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => SellerProductSkuVariant, (variant) => variant.sku)
  variants: SellerProductSkuVariant[];
}
