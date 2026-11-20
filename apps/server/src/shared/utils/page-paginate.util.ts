import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

// Page-number pagination for customer-facing lists (admin lists use cursors).
// Extend this in a list's query DTO so `page` and `pageSize` pass the whitelist.
export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;
}

export interface PageRequest {
  page: number;
  pageSize: number;
  offset: number;
}

export function resolvePage(query: PageQueryDto): PageRequest {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export interface PageResult<T> {
  results: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function pageResult<T>(
  results: T[],
  total: number,
  request: PageRequest,
): PageResult<T> {
  return {
    results,
    page: request.page,
    pageSize: request.pageSize,
    total,
    totalPages: Math.ceil(total / request.pageSize),
  };
}
