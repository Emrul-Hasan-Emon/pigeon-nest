import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Cart } from './cart.entity';
import { SellerProduct } from '../product/seller-product.entity';
import { SellerProductSku } from '../product/seller-product-sku.entity';

@Entity()
@Index('UQ_cart_item_cart_sku', ['cartId', 'sellerProductSkuId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class CartItem extends BaseEntity {
  @Index()
  @Column()
  cartId: number;

  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cartId' })
  cart: Cart;

  @Index()
  @Column()
  sellerProductId: number;

  @ManyToOne(() => SellerProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerProductId' })
  product: SellerProduct;

  @Index()
  @Column()
  sellerProductSkuId: number;

  @ManyToOne(() => SellerProductSku, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerProductSkuId' })
  sku: SellerProductSku;

  @Column()
  quantity: number;

  @Column({
    type: 'double precision',
  })
  unitPrice: number;

  @Column({
    type: 'double precision',
    nullable: true,
  })
  unitDiscountedPrice: number | null;

  @Column({
    type: 'double precision',
  })
  totalPrice: number;

  @Column({
    type: 'double precision',
    nullable: true,
  })
  totalDiscountedPrice: number | null;
}
