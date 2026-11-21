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
import { ProductStatus } from '../../../database/enums/product-status.enum';
import { ProductActiveStatus } from '../../../database/enums/product-active-status.enum';
import { MAX_INT32 } from '../../../shared/constants/limits';
import { parseBoolean } from '../../../shared/utils/transform.util';

export enum ProductListSort {
  NEWEST = 'newest',
  // Most wishlisted first. `cursor` then counts rows already seen (an offset), not an id.
  MOST_SAVED = 'mostSaved',
}

export class ListProductQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerId?: number;

  // One box: partial, case-insensitive match on the seller's name, email or phone.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sellerSearch?: string;

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

  // Read directly by @CursorPaginationParams(), not used here — declared so
  // the whitelist validator doesn't reject them as unknown properties.
  // newest (default) or mostSaved. With mostSaved the cursor is an offset.
  @IsOptional()
  @IsEnum(ProductListSort)
  sort?: ProductListSort;

  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}
