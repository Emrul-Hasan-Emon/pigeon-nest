import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Matches, Min } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export enum ReportGroup {
  DAY = 'day',
  MONTH = 'month',
}

export enum ProductReportKind {
  BEST = 'best',
  SLOW = 'slow',
  LOW_STOCK = 'low',
}

/** The dates a report covers, both days included. Leave them out for the last 30 days. */
export class ReportRangeDto {
  @IsOptional()
  @Matches(DAY, { message: 'from must be a date like 2026-11-01' })
  from?: string;

  @IsOptional()
  @Matches(DAY, { message: 'to must be a date like 2026-11-30' })
  to?: string;
}

/** Sales and earnings are listed by day or by month. */
export class ReportGroupedDto extends ReportRangeDto {
  @IsOptional()
  @IsEnum(ReportGroup)
  groupBy?: ReportGroup;
}

export class ProductReportDto extends ReportRangeDto {
  @IsOptional()
  @IsEnum(ProductReportKind)
  kind?: ProductReportKind;
}

/* An admin may look at one seller instead of the whole platform: the Admin* DTOs add `sellerId`. */
export class AdminReportGroupedDto extends ReportGroupedDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sellerId?: number;
}

export class AdminProductReportDto extends ProductReportDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sellerId?: number;
}

export class AdminOrderReportDto extends ReportRangeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sellerId?: number;
}
