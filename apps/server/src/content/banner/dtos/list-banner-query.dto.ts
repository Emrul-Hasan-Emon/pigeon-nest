import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { BannerPosition } from '../../../database/enums/banner-position.enum';
import { parseBoolean } from '../../../shared/utils/transform.util';

export enum BannerSort {
  NEWEST = 'newest',
  DISPLAY_ORDER = 'displayOrder',
}

export enum BannerSchedule {
  LIVE = 'live',
  SCHEDULED = 'scheduled',
  EXPIRED = 'expired',
}

export class ListBannerQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(BannerPosition)
  position?: BannerPosition;

  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  isActive?: boolean;

  // live = active and inside its window; scheduled = starts later; expired = ended.
  @IsOptional()
  @IsEnum(BannerSchedule)
  schedule?: BannerSchedule;

  // newest (default): id descending. displayOrder: sortOrder, then id ascending.
  @IsOptional()
  @IsEnum(BannerSort)
  sort?: BannerSort;

  // Read directly by @CursorPaginationParams(); declared for the whitelist.
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}
