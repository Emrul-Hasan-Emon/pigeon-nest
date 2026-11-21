import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Order } from '../order/order.entity';
import { OrderItem } from '../order/order-item.entity';
import { User } from '../person/user.entity';
import { SellerProduct } from '../product/seller-product.entity';
import { ReviewStatus } from '../../enums/review.enums';

// One verified-purchase review per delivered order line. Replies live in
// review_reply, so they never touch the rating numbers.
@Entity()
@Check('CHK_review_rating', '"rating" BETWEEN 1 AND 5')
@Check('CHK_review_counters', '"helpfulCount" >= 0 AND "reportCount" >= 0 AND "replyCount" >= 0')
@Index('UQ_review_live_order_item', ['orderItemId'], { unique: true, where: '"deletedAt" IS NULL' })
@Index('IDX_review_product_status', ['sellerProductId', 'status'])
export class Review extends BaseEntity {
  @Index('IDX_review_userId')
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_review_userId' })
  user: User;

  @Column()
  sellerProductId: number;

  @ManyToOne(() => SellerProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerProductId', foreignKeyConstraintName: 'FK_review_sellerProductId' })
  product: SellerProduct;

  @Index('IDX_review_orderId')
  @Column()
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId', foreignKeyConstraintName: 'FK_review_orderId' })
  order: Order;

  @Column()
  orderItemId: number;

  @ManyToOne(() => OrderItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderItemId', foreignKeyConstraintName: 'FK_review_orderItemId' })
  orderItem: OrderItem;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'varchar', length: 20, default: ReviewStatus.PUBLISHED })
  status: ReviewStatus;

  @Column({ type: 'text', nullable: true })
  hiddenReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  hiddenAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  helpfulCount: number;

  // Reports still waiting for an admin.
  @Column({ type: 'int', default: 0 })
  reportCount: number;

  // Every reply in the thread that is not deleted.
  @Column({ type: 'int', default: 0 })
  replyCount: number;
}
