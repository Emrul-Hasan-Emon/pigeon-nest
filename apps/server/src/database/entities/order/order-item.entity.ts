import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Order } from './order.entity';
import { SellerProduct } from '../product/seller-product.entity';
import { SellerProductSku } from '../product/seller-product-sku.entity';
import { SkuPriceProposal } from '../proposal/sku-price-proposal.entity';
import { DEFAULT_CURRENCY } from '../../enums/currency';

@Entity()
export class OrderItem extends BaseEntity {
  // ISO 4217 code of every amount on this row.
  @Column({ type: 'char', length: 3, default: DEFAULT_CURRENCY })
  currency: string;

  @Index()
  @Column()
  orderId: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  sellerProductId: number;

  @ManyToOne(() => SellerProduct, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerProductId' })
  product: SellerProduct;

  @Column()
  sellerProductSkuId: number;

  @ManyToOne(() => SellerProductSku, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerProductSkuId' })
  sku: SellerProductSku;

  @Column({ type: 'varchar', length: 255 })
  productName: string;

  @Column({ type: 'jsonb' })
  skuData: Record<string, unknown>;

  @Column()
  quantity: number;

  @Column({
    type: 'double precision',
  })
  unitPrice: number;

  @Column({
    type: 'double precision',
    nullable: true,
  })
  unitDiscountedPrice: number | null;

  @Column({
    type: 'double precision',
  })
  totalPrice: number; // totalPrice = unitPrice * quantity

  @Column({
    type: 'double precision',
    nullable: true,
  })
  totalDiscountedPrice: number | null; // totalDiscountedPrice = unitDiscountedPrice * quantity

  // Bought at a proposal price. unitPrice / unitDiscountedPrice stay the SKU
  // price at order time; the line is payable at the proposal price.
  @Column({ type: 'int', nullable: true })
  proposalId: number | null;

  @ManyToOne(() => SkuPriceProposal, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'proposalId' })
  proposal: SkuPriceProposal | null;

  @Column({ type: 'double precision', nullable: true })
  unitProposalPrice: number | null;

  @Column({ type: 'double precision', nullable: true })
  totalProposalPrice: number | null; // unitProposalPrice * quantity

  // The platform's cut of this line, worked out when the order was placed. The
  // order's systemCommission is the sum of its lines.
  @Column({ type: 'double precision', default: 0 })
  systemCommission: number;

  // What the line pays out to the seller: its payable amount minus systemCommission.
  @Column({ type: 'double precision', default: 0 })
  sellerAmount: number;

  // The line was sent back and refunded (a return reached `returned`).
  @Index('IDX_order_item_isReturned')
  @Column({ type: 'boolean', default: false })
  isReturned: boolean;
}
