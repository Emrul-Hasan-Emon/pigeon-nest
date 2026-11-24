import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { emptyToNull } from '../../shared/utils/transform.util';

/**
 * The selling switch. `isEnabledForSell: false` hides the seller and everything of theirs from buyers until it is
 * switched on again. A planned break (`breakStartsOn` and `breakEndsOn`, both included) hides them only between
 * those days. Set both dates or neither.
 */
export class SellingSwitchDto {
  @IsBoolean()
  isEnabledForSell: boolean;

  @IsOptional()
  @Transform(emptyToNull)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'breakStartsOn must be a date like 2026-12-20' })
  breakStartsOn?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'breakEndsOn must be a date like 2026-12-31' })
  breakEndsOn?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(300)
  note?: string | null;
}
