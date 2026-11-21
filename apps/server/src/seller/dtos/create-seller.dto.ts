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
import { CommissionType } from '../../database/enums/commission-type.enum';
import { MAX_DECIMAL_12_2 } from '../../shared/constants/limits';
import { IsInternationalPhone } from '../../shared/validators/international-phone.decorator';
import { trimString } from '../../shared/utils/transform.util';

// Multipart form (plus optional avatar / nidFrontImage / nidBackImage files).
// Sellers created by an admin are always approved + active.
export class CreateSellerDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() || undefined : value,
  )
  @IsEmail()
  @MaxLength(255)
  email?: string;

  // Required: the phone number is the seller's login.
  @IsInternationalPhone()
  phone: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  // The seller's own commission. Send both fields, or neither to use the global setting.
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
}
