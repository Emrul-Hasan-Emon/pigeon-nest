import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MAX_DECIMAL_12_2, MAX_INT32 } from '../../shared/constants/limits';
import { emptyToUndefined, parseBoolean } from '../../shared/utils/transform.util';

// cursor and limit are read by @CursorPaginationParams(); listed so the whitelist lets them through.
class Paged {
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}

/** The customer's own list. */
export class ListWishlistQueryDto extends Paged {
  // true: only what can be bought now. false: only what cannot.
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  inStock?: boolean;

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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerId?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;
}

/** Every saved row, with the customer, seller and product beside it. */
export class AdminListWishlistQueryDto extends Paged {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  userId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  productId?: number;

  // product name
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;

  // customer name, email or phone
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  userSearch?: string;

  // seller name, email or phone
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  sellerSearch?: string;
}

/** Most-saved products report (admin). */
export class MostSavedQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerId?: number;

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
  @Max(100)
  limit?: number;
}

/** Seller's top saved products. */
export class InsightsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
