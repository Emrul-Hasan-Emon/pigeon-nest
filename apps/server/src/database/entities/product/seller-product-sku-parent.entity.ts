import { Check, Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { SellerProductSku } from './seller-product-sku.entity';

export enum ParentRole {
  SIRE = 'sire',
  DAM = 'dam',
}

// One parent (father or mother) of the bird a SKU sells. A SKU has at most one of each.
@Entity()
@Unique('UQ_seller_product_sku_parent_role', ['sellerProductSkuId', 'role'])
@Check('CHK_seller_product_sku_parent_role', `"role" IN ('sire','dam')`)
export class SellerProductSkuParent extends BaseEntity {
  @Index('IDX_seller_product_sku_parent_sku')
  @Column()
  sellerProductSkuId: number;

  @ManyToOne(() => SellerProductSku, (sku) => sku.parents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerProductSkuId', foreignKeyConstraintName: 'FK_seller_product_sku_parent_sku' })
  sku: SellerProductSku;

  @Column({ type: 'varchar', length: 10 })
  role: ParentRole;

  @Column({ type: 'varchar', length: 120, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  ringNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  imagePath: string | null;
}
