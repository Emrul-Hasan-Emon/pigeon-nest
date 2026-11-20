import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BannerPosition } from '../../../database/enums/banner-position.enum';
import {
  emptyToUndefined,
  parseBoolean,
  trimString,
} from '../../../shared/utils/transform.util';

export const BANNER_LINK_PATTERN = /^(https?:\/\/\S+|\/\S*)$/;

// Multipart form; the files are `image` (required) and `mobileImage`.
export class CreateBannerDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title: string;

  // Absolute http(s) URL or an in-app path starting with "/".
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(2000)
  @Matches(BANNER_LINK_PATTERN, {
    message: 'linkUrl must be an http(s) URL or a path starting with "/"',
  })
  linkUrl?: string;

  @IsEnum(BannerPosition)
  position: BannerPosition;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  isActive?: boolean;
}
