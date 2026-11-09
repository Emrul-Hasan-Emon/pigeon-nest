import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { SellerProduct } from '../product/seller-product.entity';
import { MediaType } from '../../enums/media-type.enum';

@Entity()
export class SellerProductMedia extends BaseEntity {
  @Index()
  @Column()
  sellerProductId: number;

  @ManyToOne(() => SellerProduct, (product) => product.media, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sellerProductId' })
  product: SellerProduct;

  @Column()
  url: string;

  @Column()
  path: string;

  @Column({ type: 'varchar', default: MediaType.IMAGE })
  type: MediaType;

  @Column({ nullable: true })
  altText: string;

  @Column({ default: false })
  isPrimary: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;
}
