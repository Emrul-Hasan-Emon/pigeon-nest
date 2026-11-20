import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserStatus } from '../../database/enums/user-status.enum';
import { IsDefinedWhenPresent } from '../../shared/decorators/defined-when-present.decorator';
import { IsInternationalPhone } from '../../shared/validators/international-phone.decorator';
import { trimString } from '../../shared/utils/transform.util';

// Multipart form (plus an optional `avatar` file). Every field is optional.
// `statusReason` is required when suspending and is only accepted together
// with a status that actually changes; it is written to the status history.
export class UpdateUserDto {
  @IsDefinedWhenPresent()
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
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  statusReason?: string;
}
