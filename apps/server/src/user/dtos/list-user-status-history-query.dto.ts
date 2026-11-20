import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { UserStatus } from '../../database/enums/user-status.enum';
import { MAX_INT32 } from '../../shared/constants/limits';

export class ListUserStatusHistoryQueryDto {
  // User name, email or phone.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  // Limit the log to one user (used by the user details page).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  userId?: number;

  @IsOptional()
  @IsEnum(UserStatus)
  fromStatus?: UserStatus;

  @IsOptional()
  @IsEnum(UserStatus)
  toStatus?: UserStatus;

  // Read directly by @CursorPaginationParams(), not used here — declared so
  // the whitelist validator doesn't reject them as unknown properties.
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}
