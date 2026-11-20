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
import { SellerActiveStatus } from '../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../database/enums/seller-status.enum';
import { SellerStatusChangeAction } from '../../database/enums/seller-status-change-action.enum';
import { MAX_INT32 } from '../../shared/constants/limits';

export class ListSellerStatusHistoryQueryDto {
  // Seller name, email or phone.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  // Limit the log to one seller (used by the seller details page).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  sellerId?: number;

  @IsOptional()
  @IsEnum(SellerStatusChangeAction)
  action?: SellerStatusChangeAction;

  @IsOptional()
  @IsEnum(SellerStatus)
  toStatus?: SellerStatus;

  @IsOptional()
  @IsEnum(SellerActiveStatus)
  toActiveStatus?: SellerActiveStatus;

  // Read directly by @CursorPaginationParams(), not used here — declared so
  // the whitelist validator doesn't reject them as unknown properties.
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}
