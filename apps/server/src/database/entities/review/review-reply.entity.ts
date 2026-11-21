import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { AuthUserType } from '../../enums/auth-user-type.enum';
import { ReviewStatus } from '../../enums/review.enums';
import { Review } from './review.entity';

// A threaded reply under a review. Replies nest through parentId; reviewId
// always points at the root review so a whole thread loads with one query.
@Entity('review_reply')
@Check('CHK_review_reply_depth', '"depth" >= 1')
@Index('IDX_review_reply_thread', ['reviewId', 'parentId', 'id'])
@Index('IDX_review_reply_author', ['authorType', 'authorId'])
export class ReviewReply extends BaseEntity {
  @Column()
  reviewId: number;

  @ManyToOne(() => Review, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewId', foreignKeyConstraintName: 'FK_review_reply_reviewId' })
  review: Review;

  // null: a direct reply to the review.
  @Column({ type: 'int', nullable: true })
  parentId: number | null;

  @ManyToOne(() => ReviewReply, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parentId', foreignKeyConstraintName: 'FK_review_reply_parentId' })
  parent: ReviewReply | null;

  // 1 for a direct reply, 2 for a reply to a reply, and so on (capped in code).
  @Column({ type: 'int' })
  depth: number;

  // Ids from the root down, e.g. "12/45/78/": orders a thread and finds a subtree.
  @Index('IDX_review_reply_path')
  @Column({ type: 'varchar', length: 300 })
  path: string;

  // Who wrote it: a customer, a seller or an admin.
  @Column({ type: 'varchar', length: 10 })
  authorType: AuthUserType;

  @Column()
  authorId: number;

  // Masked name as shown to the public: "Rahim K.", the shop name, or "Support".
  @Column({ type: 'varchar', length: 255 })
  authorName: string;

  // Set when a reply past the depth cap is attached to its parent's level.
  @Column({ type: 'varchar', length: 255, nullable: true })
  replyToName: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 20, default: ReviewStatus.PUBLISHED })
  status: ReviewStatus;

  @Column({ type: 'text', nullable: true })
  hiddenReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  hiddenAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  // Direct children that are not deleted.
  @Column({ type: 'int', default: 0 })
  replyCount: number;
}
