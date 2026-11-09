import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { SellerProductSku } from './seller-product-sku.entity';
import { Attribute } from '../attribute/attribute.entity';
import { AttributeValue } from '../attribute/attribute-value.entity';
import { SellerProduct } from './seller-product.entity';

@Entity()
export class SellerProductSkuVariant extends BaseEntity {
  @Index()
  @Column()
  sellerProductId: number;

  @ManyToOne(() => SellerProduct, (product) => product.skus, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sellerProductId' })
  product: SellerProduct;

  @Index()
  @Column()
  sellerProductSkuId: number;

  @ManyToOne(() => SellerProductSku, (sku) => sku.variants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sellerProductSkuId' })
  sku: SellerProductSku;

  @Index()
  @Column()
  attributeId: number;

  @ManyToOne(() => Attribute, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'attributeId' })
  attribute: Attribute;

  @Index()
  @Column()
  attributeValueId: number;

  @ManyToOne(() => AttributeValue, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'attributeValueId' })
  attributeValue: AttributeValue;

  @Column({ default: true })
  isActive: boolean;
}
