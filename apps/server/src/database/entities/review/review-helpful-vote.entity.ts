import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { User } from '../person/user.entity';
import { Review } from './review.entity';

// One "helpful" vote per customer per review. Removing the vote deletes the row.
@Entity('review_helpful_vote')
@Unique('UQ_review_helpful_vote', ['reviewId', 'userId'])
export class ReviewHelpfulVote extends BaseEntity {
  @Column()
  reviewId: number;

  @ManyToOne(() => Review, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewId', foreignKeyConstraintName: 'FK_review_helpful_vote_reviewId' })
  review: Review;

  @Index('IDX_review_helpful_vote_userId')
  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_review_helpful_vote_userId' })
  user: User;
}
