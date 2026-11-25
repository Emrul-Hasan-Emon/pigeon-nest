import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { User } from '../person/user.entity';
import { Seller } from '../seller/seller.entity';
import { SellerProduct } from '../product/seller-product.entity';
import { SellerProductSku } from '../product/seller-product-sku.entity';
import { Order } from '../order/order.entity';
import { AuthUserType } from '../../enums/auth-user-type.enum';
import { ProposalParty, SkuPriceProposalStatus } from '../../enums/sku-price-proposal.enums';
import { DEFAULT_CURRENCY } from '../../enums/currency';

// A buyer's own price for one SKU, private to that buyer and the seller.
// One row is the whole negotiation: `price` and `quantity` hold the latest
// figures (the agreed ones once accepted) and SkuPriceProposalHistory keeps
// every step. A buyer can hold only one open (pending or accepted) proposal
// per SKU; the partial unique index below enforces it.
@Entity()
@Check('CHK_sku_price_proposal_price', '"price" > 0')
@Check('CHK_sku_price_proposal_quantity', '"quantity" > 0')
@Index('UQ_sku_price_proposal_open', ['userId', 'sellerProductSkuId'], {
  unique: true,
  where: `"deletedAt" IS NULL AND "status" IN ('pending', 'accepted')`,
})
@Index('IDX_sku_price_proposal_seller_status', ['sellerId', 'status'])
@Index('IDX_sku_price_proposal_user_status', ['userId', 'status'])
export class SkuPriceProposal extends BaseEntity {
  // ISO 4217 code of every amount on this row.
  @Column({ type: 'char', length: 3, default: DEFAULT_CURRENCY })
  currency: string;

  // The buyer.
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // Copied from the product so seller lists need no join.
  @Column()
  sellerId: number;

  @ManyToOne(() => Seller, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId' })
  seller: Seller;

  @Index()
  @Column()
  sellerProductId: number;

  @ManyToOne(() => SellerProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerProductId' })
  product: SellerProduct;

  @Index()
  @Column()
  sellerProductSkuId: number;

  @ManyToOne(() => SellerProductSku, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerProductSkuId' })
  sku: SellerProductSku;

  @Column()
  quantity: number;

  // Per unit. The buyer's offer first, then each counter, finally the agreed price.
  @Column({ type: 'double precision' })
  price: number;

  // What the SKU cost (live discount, else list price) when the proposal began.
  @Column({ type: 'double precision' })
  skuPriceAtCreate: number;

  @Column({ type: 'varchar', length: 20, default: SkuPriceProposalStatus.PENDING })
  status: SkuPriceProposalStatus;

  // Who must answer next while pending; null once closed or accepted.
  @Column({ type: 'varchar', length: 10, nullable: true })
  awaitingParty: ProposalParty | null;

  // Who closed it (rejected / cancelled) and why. The admin can close an accepted one.
  @Column({ type: 'varchar', nullable: true })
  closedByType: AuthUserType | null;

  @Column({ type: 'int', nullable: true })
  closedById: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  closeNote: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  // The order placed at this price.
  @Column({ type: 'int', nullable: true })
  orderId: number | null;

  @ManyToOne(() => Order, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Order | null;
}
