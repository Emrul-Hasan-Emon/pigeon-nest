import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { User } from '../person/user.entity';
import { SellerProduct } from '../product/seller-product.entity';

@Entity()
export class Review extends BaseEntity {
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

  @Column({ type: 'int', nullable: true })
  orderId: number | null;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'jsonb', nullable: true })
  images: string[] | null;

  @Index()
  @Column({ default: false })
  isApproved: boolean;
}
