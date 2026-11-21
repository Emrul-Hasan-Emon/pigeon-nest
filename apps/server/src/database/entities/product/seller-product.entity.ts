import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Seller } from '../seller/seller.entity';
import { Category } from '../category/category.entity';
import { Collection } from '../collection/collection.entity';
import { SellerProductSku } from './seller-product-sku.entity';
import { ProductStatus } from '../../enums/product-status.enum';
import { ProductActiveStatus } from '../../enums/product-active-status.enum';
import { SellerProductStatusChangeHistory } from './seller-product-status-change-history.entity';
import { SellerProductMedia } from '../product-media/seller-product-media.entity';

@Entity()
@Unique(['sellerId', 'slug'])
@Check('CHK_seller_product_wishlistCount', '"wishlistCount" >= 0')
export class SellerProduct extends BaseEntity {
  @Index()
  @Column()
  sellerId: number;

  @ManyToOne(() => Seller, (seller) => seller.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sellerId' })
  seller: Seller;

  @Index()
  @Column()
  categoryId: number;

  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Index()
  @Column({ type: 'int', nullable: true })
  collectionId: number | null;

  @ManyToOne(() => Collection, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'collectionId' })
  collection: Collection;

  @Column({ type: 'varchar', length: 400 })
  name: string;

  @Column()
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column({ nullable: true })
  thumbnailPath: string;

  @Column({ default: false })
  isFeatured: boolean;

  // How many customers have this product in their wishlist. Kept in step with
  // the wishlist table inside the same transaction as every add / remove.
  @Index('IDX_seller_product_wishlistCount')
  @Column({ type: 'int', default: 0 })
  wishlistCount: number;

  // A product is visible on the storefront only when it is approved AND active.
  @Index()
  @Column({ type: 'varchar', default: ProductStatus.APPROVED })
  status: ProductStatus;

  @Index()
  @Column({ type: 'varchar', default: ProductActiveStatus.ACTIVE })
  activeStatus: ProductActiveStatus;

  // Why an admin rejected / suspended the product; shown to the seller.
  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'text', nullable: true })
  suspensionReason: string | null;

  @Column({ nullable: true })
  seoTitle: string;

  @Column({ nullable: true })
  seoDescription: string;

  @OneToMany(() => SellerProductSku, (sku) => sku.product)
  skus: SellerProductSku[];

  @OneToMany(() => SellerProductMedia, (media) => media.product)
  media: SellerProductMedia[];

  @OneToMany(
    () => SellerProductStatusChangeHistory,
    (history) => history.product,
  )
  statusHistory: SellerProductStatusChangeHistory[];
}
