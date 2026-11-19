import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListSellerRequestQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  // Read directly by @CursorPaginationParams(), not used here — declared so
  // the whitelist validator doesn't reject them as unknown properties.
  @IsOptional()
  cursor?: string;

  @IsOptional()
  limit?: string;
}
