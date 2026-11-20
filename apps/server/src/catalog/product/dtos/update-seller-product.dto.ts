import { IsIn } from 'class-validator';
import { IsDefinedWhenPresent } from '../../../shared/decorators/defined-when-present.decorator';
import { ProductActiveStatus } from '../../../database/enums/product-active-status.enum';
import { UpdateProductBaseDto } from './update-seller-product-base.dto';

// Seller edit. A seller can switch active / inactive, never suspend, and can
// never touch `status`.
export class UpdateSellerProductDto extends UpdateProductBaseDto {
  @IsDefinedWhenPresent()
  @IsIn([ProductActiveStatus.ACTIVE, ProductActiveStatus.INACTIVE])
  activeStatus?: ProductActiveStatus.ACTIVE | ProductActiveStatus.INACTIVE;
}
