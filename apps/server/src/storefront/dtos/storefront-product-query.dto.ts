import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_DECIMAL_12_2, MAX_INT32 } from '../../shared/constants/limits';
import { PageQueryDto } from '../../shared/utils/page-paginate.util';
import {
  emptyToUndefined,
  parseBoolean,
} from '../../shared/utils/transform.util';
import { ProductSort } from '../storefront-product.service';

export class StorefrontProductQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  categoryId?: number;

  // Default true: a category also shows its subcategories' products.
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  includeSubcategories?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  collectionId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerId?: number;

  // true: only products the admin marked as featured.
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  maxPrice?: number;

  // Bird filters: the exact breed or bloodline a seller gave (not case sensitive).
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(120)
  breed?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(120)
  bloodline?: string;

  // true: only birds with a vaccination date on a live option.
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  vaccinated?: boolean;

  @IsOptional()
  @IsEnum(ProductSort)
  sort?: ProductSort;
}
