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
  emptyToNull,
  parseBoolean,
  trimString,
} from '../../../shared/utils/transform.util';
import { IsDefinedWhenPresent } from '../../../shared/decorators/defined-when-present.decorator';
import { BANNER_LINK_PATTERN } from './create-banner.dto';

// Multipart form. A blank linkUrl / startsAt / endsAt clears that field.
export class UpdateBannerDto {
  @IsDefinedWhenPresent()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000)
  @Matches(BANNER_LINK_PATTERN, {
    message: 'linkUrl must be an http(s) URL or a path starting with "/"',
  })
  linkUrl?: string | null;

  @IsDefinedWhenPresent()
  @IsEnum(BannerPosition)
  position?: BannerPosition;

  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  endsAt?: string | null;

  @IsDefinedWhenPresent()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @IsDefinedWhenPresent()
  @Transform(parseBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  removeMobileImage?: boolean;
}
