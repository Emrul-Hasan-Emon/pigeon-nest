import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MAX_INT32 } from '../../../shared/constants/limits';
import { trimString } from '../../../shared/utils/transform.util';

export enum BulkProductAction {
  ACTIVATE = 'activate',
  DEACTIVATE = 'deactivate',
  PRICE = 'price',
  // Admin only
  APPROVE = 'approve',
  REJECT = 'reject',
  SUSPEND = 'suspend',
}

/** Change many products in one go. Each is changed on its own, so one that cannot change does not stop the others. */
export class BulkProductDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT32, { each: true })
  productIds: number[];

  @IsEnum(BulkProductAction)
  action: BulkProductAction;

  // Price changes: raise or lower every option's price by a percentage or a fixed amount.
  @ValidateIf((o: BulkProductDto) => o.action === BulkProductAction.PRICE)
  @IsIn(['percent', 'amount'])
  mode?: 'percent' | 'amount';

  @ValidateIf((o: BulkProductDto) => o.action === BulkProductAction.PRICE)
  @IsIn(['increase', 'decrease'])
  direction?: 'increase' | 'decrease';

  @ValidateIf((o: BulkProductDto) => o.action === BulkProductAction.PRICE)
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000)
  value?: number;

  // Rejecting or suspending needs a reason; the seller sees it.
  @ValidateIf((o: BulkProductDto) => o.action === BulkProductAction.REJECT || o.action === BulkProductAction.SUSPEND)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason?: string;
}
