import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CommissionHistoryType } from '../../database/enums/commission-history-type.enum';
import { CommissionStatus } from '../../database/enums/commission-status.enum';
import { CommissionType } from '../../database/enums/commission-type.enum';
import { PaymentStatus } from '../../database/enums/payment-status.enum';
import { SellerSettingType } from '../../database/enums/seller-setting-type.enum';
import { MAX_DECIMAL_12_2, MAX_INT32 } from '../../shared/constants/limits';
import { emptyToUndefined } from '../../shared/utils/transform.util';

// Multipart bodies arrive as strings.
export const toNumber = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? (value.trim() === '' ? undefined : Number(value)) : value;

/** Set or change a seller's own commission. */
export class SetSellerCommissionDto {
  @IsEnum(CommissionType)
  commissionType: CommissionType;

  @Transform(toNumber)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  commissionAmount: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Record a commission payment received from a seller. Files come as multipart `files` (optional). */
export class DisburseCommissionDto {
  @Transform(toNumber)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_DECIMAL_12_2)
  amount: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  notes?: string;
}

// cursor and limit are read by @CursorPaginationParams(); declared so the whitelist accepts them.
class Paged {
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}

const optionalId = () => [
  IsOptional(),
  Type(() => Number),
  IsInt(),
  Min(1),
  Max(MAX_INT32),
];
function applyAll(decorators: PropertyDecorator[]): PropertyDecorator {
  return (target, key) => decorators.forEach((d) => d(target, key));
}

export class ListBalanceQueryDto extends Paged {
  @applyAll(optionalId())
  sellerId?: number;

  // Seller name, email or phone.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  // due: still owes commission. cleared: nothing due.
  @IsOptional()
  @IsIn(['due', 'cleared'])
  status?: 'due' | 'cleared';
}

export class ListCommissionHistoryQueryDto extends Paged {
  @applyAll(optionalId())
  sellerId?: number;

  @applyAll(optionalId())
  orderId?: number;

  @IsOptional()
  @IsEnum(CommissionHistoryType)
  type?: CommissionHistoryType;

  // for_system, order_returned_to_customer, ...
  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;

  // The order's payment status when the row was written.
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  // true: only voided rows. false: only live rows. Left out: both.
  @IsOptional()
  @IsIn(['true', 'false'])
  voided?: string;
}

/** The change log of the balance: every move of total, due and paid. */
export class ListCommissionChangesQueryDto extends Paged {
  @applyAll(optionalId())
  sellerId?: number;

  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class ListDisburseQueryDto extends Paged {
  @applyAll(optionalId())
  sellerId?: number;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxAmount?: number;
}

export class ListSettingHistoryQueryDto extends Paged {
  @applyAll(optionalId())
  sellerId?: number;

  @IsOptional()
  @IsEnum(SellerSettingType)
  settingType?: SellerSettingType;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
