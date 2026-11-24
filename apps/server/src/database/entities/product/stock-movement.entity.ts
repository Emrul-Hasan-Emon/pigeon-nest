import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { StockReason } from '../../enums/stock-movement.enum';

// One change to one SKU's stock, kept forever so a seller can see why a number is what it is.
// The product and SKU are plain numbers (no foreign keys): the history must survive a deleted option.
@Entity()
@Index('IDX_stock_movement_product', ['sellerProductId', 'id'])
@Index('IDX_stock_movement_sku', ['sellerProductSkuId'])
export class StockMovement extends BaseEntity {
  @Column()
  sellerProductId: number;

  @Column()
  sellerProductSkuId: number;

  @Column()
  sellerId: number;

  // The option's name at the time (its code, or its description).
  @Column({ type: 'varchar', length: 200 })
  skuLabel: string;

  // Plus when stock went up, minus when it went down.
  @Column({ type: 'int' })
  change: number;

  @Column({ type: 'int' })
  quantityAfter: number;

  @Column({ type: 'varchar', length: 30 })
  reason: StockReason;

  @Column({ type: 'int', nullable: true })
  orderId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;
}
