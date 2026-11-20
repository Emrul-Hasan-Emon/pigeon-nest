import { IsIn } from 'class-validator';
import { IsDefinedWhenPresent } from '../../../shared/decorators/defined-when-present.decorator';
import { ProductActiveStatus } from '../../../database/enums/product-active-status.enum';
import { CreateProductBaseDto } from './create-seller-product-base.dto';

// A seller creating their own product. Status is always approved; the seller
// can start it active (default) or inactive, never suspended.
export class CreateSellerProductDto extends CreateProductBaseDto {
  @IsDefinedWhenPresent()
  @IsIn([ProductActiveStatus.ACTIVE, ProductActiveStatus.INACTIVE])
  activeStatus?: ProductActiveStatus.ACTIVE | ProductActiveStatus.INACTIVE;
}
