import { IsInt, Max, Min } from 'class-validator';
import { MAX_INT32 } from '../../../shared/constants/limits';

export class SkuVariantPairDto {
  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  attributeId: number;

  @IsInt()
  @Min(1)
  @Max(MAX_INT32)
  attributeValueId: number;
}
