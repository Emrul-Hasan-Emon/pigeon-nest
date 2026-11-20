import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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
import { UpdateProductSkuDto } from './update-product-sku.dto';

// Fields both admins and sellers can change. `null` is rejected everywhere
// except `collectionId` (null detaches it).
export class UpdateProductBaseDto {
  @IsDefinedWhenPresent()
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  categoryId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  collectionId?: number | null;

  @IsDefinedWhenPresent()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  name?: string;

  @IsDefinedWhenPresent()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @IsDefinedWhenPresent()
  @IsString()
  @MaxLength(255)
  seoTitle?: string;

  @IsDefinedWhenPresent()
  @IsString()
  @MaxLength(1000)
  seoDescription?: string;

  // Entries with `id` update that SKU; entries without `id` create a new one.
  @IsDefinedWhenPresent()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => UpdateProductSkuDto)
  skus?: UpdateProductSkuDto[];

  // SKUs to soft-delete.
  @IsDefinedWhenPresent()
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT32, { each: true })
  removeSkuIds?: number[];
}
