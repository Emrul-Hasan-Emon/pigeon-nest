import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsDefinedWhenPresent } from '../../../shared/decorators/defined-when-present.decorator';
import {
  MAX_DECIMAL_12_2,
  MAX_INT32,
} from '../../../shared/constants/limits';
import { SkuVariantPairDto } from './sku-variant-pair.dto';
import { BirdSkuFieldsDto } from './bird-fields.dto';

const MONEY = { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false };

// One entry of `skus` in the product update payload.
// - With `id`: updates that SKU (variants and the SKU code are immutable).
// - Without `id`: creates a new SKU; `price` and `variants` are then required.
// `null` is never accepted — omit a field to leave it alone.
export class UpdateProductSkuDto extends BirdSkuFieldsDto {
  @IsDefinedWhenPresent()
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  id?: number;

  // Only valid when creating (no id). Blank strings are treated as "no code".
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(100)
  sku?: string;

  @IsDefinedWhenPresent()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsDefinedWhenPresent()
  @IsInt()
  @Min(0)
  @Max(MAX_INT32)
  quantity?: number;

  @IsDefinedWhenPresent()
  @IsInt()
  @Min(0)
  @Max(MAX_INT32)
  lowStockThreshold?: number;

  @IsDefinedWhenPresent()
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  myBuyingPrice?: number;

  @IsDefinedWhenPresent()
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  price?: number;

  @IsDefinedWhenPresent()
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  discountedPrice?: number;

  @IsDefinedWhenPresent()
  @IsDateString()
  discountedPriceStartDate?: string;

  @IsDefinedWhenPresent()
  @IsDateString()
  discountedPriceEndDate?: string;

  @IsDefinedWhenPresent()
  @IsBoolean()
  isDefault?: boolean;

  @IsDefinedWhenPresent()
  @IsBoolean()
  isActive?: boolean;

  @IsDefinedWhenPresent()
  @IsBoolean()
  acceptProposals?: boolean;

  // Hidden from buyers. A proposal under it is turned down at once.
  @IsDefinedWhenPresent()
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  minProposalPrice?: number;

  // Only valid when creating (no id).
  @IsDefinedWhenPresent()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SkuVariantPairDto)
  variants?: SkuVariantPairDto[];
}
