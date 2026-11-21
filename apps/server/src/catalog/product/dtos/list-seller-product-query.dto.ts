import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_INT32 } from '../../../shared/constants/limits';
import { parseBoolean } from '../../../shared/utils/transform.util';
import { ProductStatus } from '../../../database/enums/product-status.enum';
import { ProductActiveStatus } from '../../../database/enums/product-active-status.enum';
import { ProductListSort } from './list-product-query.dto';

// A seller always sees only their own products, so no seller filters here.
export class ListSellerProductQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  categoryId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  collectionId?: number;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsEnum(ProductActiveStatus)
  activeStatus?: ProductActiveStatus;

  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  isFeatured?: boolean;

  // newest (default) or mostSaved. With mostSaved the cursor is an offset.
  @IsOptional()
  @IsEnum(ProductListSort)
  sort?: ProductListSort;

  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}
