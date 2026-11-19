import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
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

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate?: number;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? JSON.parse(value) : value,
  )
  payoutAccountInfo?: Record<string, unknown>;
}
