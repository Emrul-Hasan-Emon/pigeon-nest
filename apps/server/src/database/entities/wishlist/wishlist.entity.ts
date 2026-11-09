import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { User } from '../person/user.entity';
import { SellerProduct } from '../product/seller-product.entity';

@Entity()
@Unique(['userId', 'sellerProductId'])
export class Wishlist extends BaseEntity {
  @Index()
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Index()
  @Column()
  sellerProductId: number;

  @ManyToOne(() => SellerProduct, { onDelete: 'CASCADE' })
  @JoinColumn()
  product: SellerProduct;
}
