import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { SellerProduct } from './seller-product.entity';
import { ProductStatus } from '../../enums/product-status.enum';
import { ProductActiveStatus } from '../../enums/product-active-status.enum';
import { ProductStatusChangeAction } from '../../enums/product-status-change-action.enum';

// Append-only audit log: one row every time a product's status and/or
// activeStatus is set (including the initial state). Both pairs are stored on
// every row so a row shows the complete before and after. Who did it is in the
// BaseEntity tracker fields: createdBy / creatorType / creatorName.
@Entity()
export class SellerProductStatusChangeHistory extends BaseEntity {
  @Index()
  @Column()
  sellerProductId: number;

  @ManyToOne(() => SellerProduct, (product) => product.statusHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sellerProductId' })
  product: SellerProduct;

  // null on the first entry (the state the product was created with).
  @Column({ type: 'varchar', nullable: true })
  fromStatus: ProductStatus | null;

  @Column({ type: 'varchar' })
  toStatus: ProductStatus;

  @Column({ type: 'varchar', nullable: true })
  fromActiveStatus: ProductActiveStatus | null;

  @Column({ type: 'varchar' })
  toActiveStatus: ProductActiveStatus;

  @Column({ type: 'varchar' })
  action: ProductStatusChangeAction;

  // Required when an admin rejects or suspends a product; optional otherwise.
  @Column({ type: 'text', nullable: true })
  reason: string | null;
}
