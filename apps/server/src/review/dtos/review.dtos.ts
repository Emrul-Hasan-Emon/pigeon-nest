import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_INT32 } from '../../shared/constants/limits';
import { emptyToNull, emptyToUndefined, parseBoolean } from '../../shared/utils/transform.util';
import { ReviewReportReason, ReviewReportStatus, ReviewStatus, ReviewTarget } from '../../database/enums/review.enums';
import { COMMENT_MAX, NOTE_MAX, REPLY_MAX, TITLE_MAX } from '../review.constants';

// cursor and limit are read by @CursorPaginationParams(); listed so the whitelist lets them through.
class Paged {
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}

// ---- customer writes (multipart) ----

export class CreateReviewDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  orderItemId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(TITLE_MAX)
  title?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(COMMENT_MAX)
  comment?: string;
}

const toIdList = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === '') return undefined;
  const list = Array.isArray(value) ? value : String(value).split(',');
  return list.map((v) => (typeof v === 'string' ? Number(v.trim()) : v));
};

export class UpdateReviewDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  // A blank value clears the title or the comment.
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(TITLE_MAX)
  title?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(COMMENT_MAX)
  comment?: string | null;

  // Photos to drop, as a comma list or repeated field.
  @IsOptional()
  @Transform(toIdList)
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT32, { each: true })
  removeImageIds?: number[];
}

export class ReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(REPLY_MAX)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  body: string;

  // The reply this answers; leave out to answer the review itself.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  parentId?: number;
}

export class UpdateReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(REPLY_MAX)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  body: string;
}

export class ReportDto {
  @IsEnum(ReviewReportReason)
  reason: ReviewReportReason;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(NOTE_MAX)
  note?: string;
}

// ---- reads ----

export enum ReviewSort {
  NEWEST = 'newest',
  HELPFUL = 'helpful',
}

export class ListProductReviewsQueryDto extends Paged {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  withPhotos?: boolean;

  // helpful sorts by votes; its cursor is an offset (the number of rows already read).
  @IsOptional()
  @IsEnum(ReviewSort)
  sort?: ReviewSort;
}

export class ListRepliesQueryDto extends Paged {
  // Children of this reply; leave out for the replies straight under the review.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  parentId?: number;
}

export class ListMyReviewsQueryDto extends Paged {}

export class ListSellerReviewsQueryDto extends Paged {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  productId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  // true: this shop has not answered yet. false: it has.
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  unreplied?: boolean;
}

export class AdminListReviewsQueryDto extends Paged {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  productId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  userId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  // true: has open reports.
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  reported?: boolean;

  // customer name / phone / email, product name, or review text
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ModerateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(NOTE_MAX)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason: string;
}

export class RestoreDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(NOTE_MAX)
  reason?: string;
}

export class AdminListReportsQueryDto extends Paged {
  @IsOptional()
  @IsEnum(ReviewReportStatus)
  status?: ReviewReportStatus;

  @IsOptional()
  @IsEnum(ReviewTarget)
  targetType?: ReviewTarget;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  reviewId?: number;
}

export class ResolveReportDto {
  @IsIn(['hide', 'dismiss'])
  action: 'hide' | 'dismiss';

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(NOTE_MAX)
  note?: string;
}

export class SellerSummaryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  productId?: number;
}

export class VotesQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  productId: number;
}
