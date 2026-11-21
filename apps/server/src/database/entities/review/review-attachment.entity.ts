import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { Review } from './review.entity';

// A photo on a review, up to five per review.
@Entity('review_attachment')
export class ReviewAttachment extends BaseEntity {
  @Index('IDX_review_attachment_reviewId')
  @Column()
  reviewId: number;

  @ManyToOne(() => Review, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewId', foreignKeyConstraintName: 'FK_review_attachment_reviewId' })
  review: Review;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 1000 })
  fileUrl: string;

  @Column({ type: 'varchar', length: 1000 })
  filePath: string;

  @Column({ type: 'varchar', length: 150 })
  mimeType: string;

  @Column({ type: 'int' })
  size: number;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;
}
