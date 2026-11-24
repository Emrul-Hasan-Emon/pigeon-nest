import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { PageQueryDto } from '../../shared/utils/page-paginate.util';
import { emptyToUndefined } from '../../shared/utils/transform.util';

export enum OnboardingFilter {
  ALL = 'all',
  INCOMPLETE = 'incomplete',
  COMPLETE = 'complete',
}

export class SellerOnboardingQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(OnboardingFilter)
  show?: OnboardingFilter;
}
