import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsInternationalPhone } from '../../shared/validators/international-phone.decorator';
import { trimString } from '../../shared/utils/transform.util';

// Multipart form (plus an optional `avatar` file). Users created by an admin
// are always active.
export class CreateUserDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  // Blank is treated as "no email".
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() || undefined : value,
  )
  @IsEmail()
  @MaxLength(255)
  email?: string;

  // Required: the phone number is the user's login.
  @IsInternationalPhone()
  phone: string;

  // bcrypt only uses the first 72 bytes, so longer passwords are refused.
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;
}
