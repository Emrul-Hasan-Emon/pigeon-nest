import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsDefinedWhenPresent } from '../../../shared/decorators/defined-when-present.decorator';
import { MAX_INT32 } from '../../../shared/constants/limits';
import { trimString } from '../../../shared/utils/transform.util';
import { ProductStatus } from '../../../database/enums/product-status.enum';
import { ProductActiveStatus } from '../../../database/enums/product-active-status.enum';
import { CreateProductBaseDto } from './create-seller-product-base.dto';

// Admin creating a product on behalf of a seller.
export class CreateProductDto extends CreateProductBaseDto {
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerId: number;

  @IsDefinedWhenPresent()
  @IsBoolean()
  isFeatured?: boolean;

  // New products default to approved + active.
  @IsDefinedWhenPresent()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsDefinedWhenPresent()
  @IsEnum(ProductActiveStatus)
  activeStatus?: ProductActiveStatus;

  // Required when the product starts rejected or suspended; saved in the
  // status history and shown to the seller.
  @IsDefinedWhenPresent()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason?: string;
}
