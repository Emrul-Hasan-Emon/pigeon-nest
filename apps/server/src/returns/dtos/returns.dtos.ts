import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ReturnReasonCode } from '../../database/enums/return-reason-code.enum';
import { ReturnScope } from '../../database/enums/return-scope.enum';
import { ReturnStatus } from '../../database/enums/return-status.enum';
import { MAX_INT32 } from '../../shared/constants/limits';
import { PageQueryDto } from '../../shared/utils/page-paginate.util';
import { emptyToUndefined, parseBoolean, trimString } from '../../shared/utils/transform.util';

// Multipart bodies arrive as strings: ids come as "1,2,3" or repeated fields.
const toIdList = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  const parts = Array.isArray(value) ? value : String(value).split(',');
  return parts.map((v) => (typeof v === 'string' ? Number(v.trim()) : v));
};

const toInt = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? (value.trim() === '' ? undefined : Number(value)) : value;

/** A customer asks to return a whole order or some of its items. Files come as multipart `files`. */
export class CreateReturnDto {
  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  orderId: number;

  @IsEnum(ReturnScope)
  scope: ReturnScope;

  // Required for scope=items. Left out for scope=full_order.
  @ValidateIf((o: CreateReturnDto) => o.scope === ReturnScope.ITEMS || o.orderItemIds !== undefined)
  @Transform(toIdList)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT32, { each: true })
  orderItemIds?: number[];

  // Why the bird or item comes back. Left out, it counts as "other".
  @IsOptional()
  @IsEnum(ReturnReasonCode)
  reasonCode?: ReturnReasonCode;

  @Transform(trimString)
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason: string;
}

/** An admin opens a return for a customer. Same fields, plus the delivery-charge choice. */
export class AdminCreateReturnDto extends CreateReturnDto {
  // Full-order returns only. Left out, the platform setting decides.
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  includeDeliveryCharge?: boolean;
}

/** A short note on a step (cancel, processing). */
export class ReturnNoteDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  note?: string;
}

/** The seller accepts. For a full-order return they also choose whether delivery is refunded. */
export class AcceptReturnDto extends ReturnNoteDto {
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  includeDeliveryCharge?: boolean;
}

/** A rejection always needs a reason. */
export class RejectReturnDto {
  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  note: string;
}

/** The seller is paying the money back: a description is required, files are the proof. */
export class ReturningMoneyDto {
  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  note: string;
}

/** An admin moves a return to any status. A note is always required. Files are optional. */
export class AdminReturnStatusDto {
  @IsEnum(ReturnStatus)
  status: ReturnStatus;

  @Transform(trimString)
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  note: string;

  // Full-order returns only; changes whether the delivery charge is refunded.
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  includeDeliveryCharge?: boolean;
}

export class ListReturnsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(ReturnStatus)
  status?: ReturnStatus;

  @IsOptional()
  @IsEnum(ReturnScope)
  scope?: ReturnScope;

  // return number or order number
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class AdminListReturnsQueryDto extends ListReturnsQueryDto {
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
  userId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  orderId?: number;
}
