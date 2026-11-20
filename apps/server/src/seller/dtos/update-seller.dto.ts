import { Transform, Type } from 'class-transformer';
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
import { IsInternationalPhone } from '../../shared/validators/international-phone.decorator';
import { trimString } from '../../shared/utils/transform.util';

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
