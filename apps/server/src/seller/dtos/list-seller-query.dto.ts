import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SellerActiveStatus } from '../../database/enums/seller-active-status.enum';
import { SellerStatus } from '../../database/enums/seller-status.enum';

export class ListSellerQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(SellerStatus)
  status?: SellerStatus;

  @IsOptional()
  @IsEnum(SellerActiveStatus)
  activeStatus?: SellerActiveStatus;

  // Read directly by @CursorPaginationParams(), not used here — declared so
  // the whitelist validator doesn't reject them as unknown properties.
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}
