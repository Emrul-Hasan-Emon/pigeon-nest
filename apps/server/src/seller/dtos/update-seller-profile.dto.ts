import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsDefinedWhenPresent } from '../../shared/decorators/defined-when-present.decorator';
import { IsInternationalPhone } from '../../shared/validators/international-phone.decorator';
import { emptyToNull, trimString } from '../../shared/utils/transform.util';

// Multipart form. Sellers can only change these fields (plus the avatar and
// NID files) — status, activeStatus, commission etc. are admin-only and any
// attempt to send them is rejected.
export class UpdateSellerProfileDto {
  @IsDefinedWhenPresent()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  // Blank is treated as "unchanged".
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

  // Shown on the public seller page. A blank value clears it.
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}
