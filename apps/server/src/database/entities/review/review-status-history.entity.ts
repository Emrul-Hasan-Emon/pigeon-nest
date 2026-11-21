import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { ReviewStatus, ReviewTarget } from '../../enums/review.enums';

// Every hide and restore of a review or a reply, with who did it and why.
@Entity('review_status_history')
@Index('IDX_review_status_history_target', ['targetType', 'targetId'])
export class ReviewStatusHistory extends BaseEntity {
  @Column({ type: 'varchar', length: 10 })
  targetType: ReviewTarget;

  @Column()
  targetId: number;

  @Index('IDX_review_status_history_reviewId')
  @Column()
  reviewId: number;

  @Column({ type: 'varchar', length: 20 })
  fromStatus: ReviewStatus;

  @Column({ type: 'varchar', length: 20 })
  toStatus: ReviewStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;
}
