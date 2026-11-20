import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsDefinedWhenPresent } from '../../../shared/decorators/defined-when-present.decorator';
import { trimString } from '../../../shared/utils/transform.util';
import { ProductStatus } from '../../../database/enums/product-status.enum';
import { ProductActiveStatus } from '../../../database/enums/product-active-status.enum';
import { UpdateProductBaseDto } from './update-seller-product-base.dto';

// Admin edit.
export class UpdateProductDto extends UpdateProductBaseDto {
  @IsDefinedWhenPresent()
  @IsBoolean()
  isFeatured?: boolean;

  @IsDefinedWhenPresent()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsDefinedWhenPresent()
  @IsEnum(ProductActiveStatus)
  activeStatus?: ProductActiveStatus;

  // Required when this edit moves the product to rejected or suspended;
  // saved in the status history and shown to the seller.
  @IsDefinedWhenPresent()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason?: string;
}
