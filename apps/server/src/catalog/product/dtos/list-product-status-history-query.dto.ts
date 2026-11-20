import { Type } from 'class-transformer';
import {
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
import { ProductStatusChangeAction } from '../../../database/enums/product-status-change-action.enum';
import { MAX_INT32 } from '../../../shared/constants/limits';

export class ListProductStatusHistoryQueryDto {
  // Product name, or the owning seller's name / email / phone.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  // Limit the log to one product (used by the product details page).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  productId?: number;

  @IsOptional()
  @IsEnum(ProductStatusChangeAction)
  action?: ProductStatusChangeAction;

  @IsOptional()
  @IsEnum(ProductStatus)
  toStatus?: ProductStatus;

  @IsOptional()
  @IsEnum(ProductActiveStatus)
  toActiveStatus?: ProductActiveStatus;

  // Read directly by @CursorPaginationParams(), not used here — declared so
  // the whitelist validator doesn't reject them as unknown properties.
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}
