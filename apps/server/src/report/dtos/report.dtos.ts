import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Matches, Min } from 'class-validator';

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

export enum ReturnReportBy {
  REASON = 'reason',
  PRODUCT = 'product',
  SELLER = 'seller',
}

/** Return reasons report for a seller: by reason or by product. */
export class ReturnReportDto extends ReportRangeDto {
  @IsOptional()
  @IsIn([ReturnReportBy.REASON, ReturnReportBy.PRODUCT])
  by?: ReturnReportBy;
}

/** The admin may also group by seller, or narrow to one seller. */
export class AdminReturnReportDto extends ReportRangeDto {
  @IsOptional()
  @IsEnum(ReturnReportBy)
  by?: ReturnReportBy;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sellerId?: number;
}

export enum SellerRankSort {
  SALES = 'sales',
  ORDERS = 'orders',
  RATING = 'rating',
  RETURNS = 'returns',
}

/** The admin's seller ranking: who sells most, who is rated best, who has the most returns. */
export class SellerRankingDto extends ReportRangeDto {
  @IsOptional()
  @IsEnum(SellerRankSort)
  sort?: SellerRankSort;
}

/** A monthly statement: the month as YYYY-MM. Left out, this month. */
export class StatementQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must look like 2026-11' })
  month?: string;
}

export class AdminStatementQueryDto extends StatementQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sellerId: number;
}
