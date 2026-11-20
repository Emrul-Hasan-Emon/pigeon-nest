import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../shared/utils/page-paginate.util';
import { emptyToUndefined } from '../../shared/utils/transform.util';
import { SellerSort } from '../services/storefront-seller.service';

export class StorefrontSellerQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(SellerSort)
  sort?: SellerSort;
}
