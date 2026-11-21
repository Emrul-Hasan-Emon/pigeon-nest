import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Review } from './review.entity';

// What a customer's edit changed, kept so a review cannot be quietly rewritten.
@Entity('review_edit_history')
export class ReviewEditHistory extends BaseEntity {
  @Index('IDX_review_edit_history_reviewId')
  @Column()
  reviewId: number;

  @ManyToOne(() => Review, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewId', foreignKeyConstraintName: 'FK_review_edit_history_reviewId' })
  review: Review;

  @Column({ type: 'int' })
  fromRating: number;

  @Column({ type: 'int' })
  toRating: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  fromTitle: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  toTitle: string | null;

  @Column({ type: 'text', nullable: true })
  fromComment: string | null;

  @Column({ type: 'text', nullable: true })
  toComment: string | null;

  @Column({ type: 'int', default: 0 })
  imagesAdded: number;

  @Column({ type: 'int', default: 0 })
  imagesRemoved: number;
}
