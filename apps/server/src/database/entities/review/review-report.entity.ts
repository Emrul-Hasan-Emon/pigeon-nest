import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base.entity';
import { AuthUserType } from '../../enums/auth-user-type.enum';
import { ReviewReportReason, ReviewReportStatus, ReviewTarget } from '../../enums/review.enums';

// A customer's or seller's complaint about a review or a reply, for an admin to settle.
@Entity('review_report')
@Index('UQ_review_report_open', ['targetType', 'targetId', 'reporterType', 'reporterId'], {
  unique: true,
  where: `"status" = 'open' AND "deletedAt" IS NULL`,
})
@Index('IDX_review_report_status', ['status', 'id'])
export class ReviewReport extends BaseEntity {
  @Column({ type: 'varchar', length: 10 })
  targetType: ReviewTarget;

  @Column()
  targetId: number;

  @Index('IDX_review_report_reviewId')
  @Column()
  reviewId: number;

  @Column({ type: 'varchar', length: 10 })
  reporterType: AuthUserType;

  @Column()
  reporterId: number;

  @Column({ type: 'varchar', length: 255 })
  reporterName: string;

  @Column({ type: 'varchar', length: 20 })
  reason: ReviewReportReason;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 20, default: ReviewReportStatus.OPEN })
  status: ReviewReportStatus;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  resolvedBy: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resolvedByName: string | null;

  @Column({ type: 'text', nullable: true })
  resolutionNote: string | null;
}
