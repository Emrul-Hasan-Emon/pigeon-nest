import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Order } from './order.entity';
import { SellerProduct } from '../product/seller-product.entity';
import { SellerProductSku } from '../product/seller-product-sku.entity';
import { decimalTransformer } from '../../utils/decimal.transformer';

@Entity()
export class OrderItem extends BaseEntity {
  @Index()
  @Column()
  orderId: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  sellerProductId: number;

  @ManyToOne(() => SellerProduct, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerProductId' })
  product: SellerProduct;

  @Column()
  sellerProductSkuId: number;

  @ManyToOne(() => SellerProductSku, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerProductSkuId' })
  sku: SellerProductSku;

  @Column({ type: 'varchar', length: 255 })
  productName: string;

  @Column({ type: 'jsonb' })
  skuData: Record<string, unknown>;

  @Column()
  quantity: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  unitPrice: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  unitDiscountedPrice: number | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalPrice: number; // totalPrice = unitPrice * quantity

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  totalDiscountedPrice: number | null; // totalDiscountedPrice = unitDiscountedPrice * quantity
}
