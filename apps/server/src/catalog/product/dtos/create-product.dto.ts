import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsDefinedWhenPresent } from '../../../shared/decorators/defined-when-present.decorator';
import { MAX_INT32 } from '../../../shared/constants/limits';
import { trimString } from '../../../shared/utils/transform.util';
import { CreateProductSkuDto } from './create-product-sku.dto';

export class CreateProductDto {
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerId: number;

  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  categoryId: number;

  // null is accepted and means "no collection".
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  collectionId?: number | null;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  name: string;

  @IsDefinedWhenPresent()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @IsDefinedWhenPresent()
  @IsBoolean()
  isFeatured?: boolean;

  @IsDefinedWhenPresent()
  @IsBoolean()
  isPublished?: boolean;

  @IsDefinedWhenPresent()
  @IsBoolean()
  isActive?: boolean;

  @IsDefinedWhenPresent()
  @IsString()
  @MaxLength(255)
  seoTitle?: string;

  @IsDefinedWhenPresent()
  @IsString()
  @MaxLength(1000)
  seoDescription?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateProductSkuDto)
  skus: CreateProductSkuDto[];
}
