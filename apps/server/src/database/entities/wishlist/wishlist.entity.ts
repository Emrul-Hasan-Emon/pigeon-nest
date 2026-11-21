import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { User } from '../person/user.entity';
import { SellerProduct } from '../product/seller-product.entity';

// One saved product per customer. The product, not a variant: "Add to cart"
// from the list picks the same SKU the product page would.
// Removing deletes the row for good (the unique pair lets the customer save it
// again), and SellerProduct.wishlistCount moves with every insert / delete in
// the same transaction.
@Entity()
@Unique(['userId', 'sellerProductId'])
export class Wishlist extends BaseEntity {
  @Index()
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column()
  sellerProductId: number;

  @ManyToOne(() => SellerProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerProductId' })
  product: SellerProduct;

  // What the customer would have paid when they saved it (live discount, else
  // list price). The page compares it with today's price.
  @Column({ type: 'double precision', default: 0 })
  priceWhenSaved: number;
}
