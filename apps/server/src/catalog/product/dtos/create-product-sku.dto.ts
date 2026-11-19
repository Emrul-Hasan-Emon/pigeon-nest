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

const MONEY = { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false };

export class CreateProductSkuDto {
  // Blank strings are treated as "no code".
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

  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  myBuyingPrice?: number;

  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  price: number;

  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  discountedPrice?: number;

  @IsOptional()
  @IsDateString()
  discountedPriceStartDate?: string;

  @IsOptional()
  @IsDateString()
  discountedPriceEndDate?: string;

  @IsDefinedWhenPresent()
  @IsBoolean()
  isDefault?: boolean;

  @IsDefinedWhenPresent()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SkuVariantPairDto)
  variants: SkuVariantPairDto[];
}
