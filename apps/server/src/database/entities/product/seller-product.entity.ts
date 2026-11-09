import {
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
import { SellerProductMedia } from '../product-media/seller-product-media.entity';

@Entity()
@Unique(['sellerId', 'slug'])
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

  @Column({ default: false })
  isPublished: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  seoTitle: string;

  @Column({ nullable: true })
  seoDescription: string;

  @OneToMany(() => SellerProductSku, (sku) => sku.product)
  skus: SellerProductSku[];

  @OneToMany(() => SellerProductMedia, (media) => media.product)
  media: SellerProductMedia[];
}
