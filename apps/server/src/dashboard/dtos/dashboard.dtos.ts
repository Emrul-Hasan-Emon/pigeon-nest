import { IsEnum, IsOptional } from 'class-validator';

/** How far back a dashboard looks. The period before it, of the same length, is the comparison. */
export enum DashboardRange {
  WEEK = '7d',
  MONTH = '30d',
  QUARTER = '90d',
  YEAR = '12m',
}

export class DashboardQueryDto {
  @IsOptional()
  @IsEnum(DashboardRange)
  range?: DashboardRange;
}
