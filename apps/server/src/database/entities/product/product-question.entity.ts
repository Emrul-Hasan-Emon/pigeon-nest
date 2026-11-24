import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { User } from '../person/user.entity';
import { Seller } from '../seller/seller.entity';
import { QuestionStatus } from '../../enums/product-question.enum';
import { SellerProduct } from './seller-product.entity';

// A buyer asks the seller about a product. The seller answers once (and may edit the answer).
@Entity()
@Check('CHK_product_question_status', `"status" IN ('published','hidden')`)
@Index('IDX_product_question_product_status', ['sellerProductId', 'status'])
@Index('IDX_product_question_seller_answered', ['sellerId', 'answeredAt'])
export class ProductQuestion extends BaseEntity {
  @Column()
  sellerProductId: number;

  @ManyToOne(() => SellerProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerProductId', foreignKeyConstraintName: 'FK_product_question_product' })
  product: SellerProduct;

  // The product's seller, kept here so the seller's list needs no join.
  @Column()
  sellerId: number;

  @ManyToOne(() => Seller, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sellerId', foreignKeyConstraintName: 'FK_product_question_seller' })
  seller: Seller;

  @Index('IDX_product_question_user')
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_product_question_user' })
  user: User;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'varchar', length: 20, default: QuestionStatus.PUBLISHED })
  status: QuestionStatus;

  @Column({ type: 'text', nullable: true })
  hiddenReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  hiddenAt: Date | null;

  @Column({ type: 'text', nullable: true })
  answer: string | null;

  @Column({ type: 'timestamp', nullable: true })
  answeredAt: Date | null;
}
