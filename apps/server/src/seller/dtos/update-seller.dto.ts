import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SellerActiveStatus } from '../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../database/enums/seller-status.enum';
import { CommissionType } from '../../database/enums/commission-type.enum';
import { MAX_DECIMAL_12_2 } from '../../shared/constants/limits';
import { IsInternationalPhone } from '../../shared/validators/international-phone.decorator';
import { emptyToNull, trimString } from '../../shared/utils/transform.util';

// Multipart form (plus optional avatar / nidFrontImage / nidBackImage files).
// Admin has full control: status and activeStatus are independent here. Use
// the seller-requests approve/reject endpoints for the coupled transitions.
export class UpdateSellerDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() || undefined : value,
  )
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsInternationalPhone()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password?: string;

  // Shown on the public seller page. A blank value clears it.
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  // The seller's own commission. Send both fields to set or change it; send neither to leave it as it is.
  @IsOptional()
  @IsEnum(CommissionType)
  commissionType?: CommissionType;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? (value.trim() === '' ? undefined : Number(value)) : value,
  )
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_DECIMAL_12_2)
  commissionAmount?: number;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  payoutAccountInfo?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(SellerStatus)
  status?: SellerStatus;

  @IsOptional()
  @IsEnum(SellerActiveStatus)
  activeStatus?: SellerActiveStatus;

  // Note for the status history. Required when this request rejects or
  // suspends the seller; optional for any other status change. When it
  // rejects the seller it is also the reason the seller sees.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
