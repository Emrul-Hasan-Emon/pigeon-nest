import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { emptyToNull } from '../../../shared/utils/transform.util';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Facts about the birds that are true for every SKU of a product.
// All optional. A blank value or null clears the field.
export class BirdProductFieldsDto {
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  breed?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  bloodline?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(5000)
  bloodlineNote?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(5000)
  vaccinationNote?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(5000)
  healthNote?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(5000)
  raceRecord?: string | null;
}

// Facts about the one bird (or batch) a SKU sells. All optional. A blank value or null clears the field.
export class BirdSkuFieldsDto {
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(60)
  ringNumber?: string | null;

  // YYYY-MM-DD
  @IsOptional()
  @Transform(emptyToNull)
  @Matches(DAY, { message: 'hatchDate must be a date like 2026-03-14' })
  hatchDate?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  vaccineName?: string | null;

  // YYYY-MM-DD
  @IsOptional()
  @Transform(emptyToNull)
  @Matches(DAY, { message: 'vaccinatedOn must be a date like 2026-03-14' })
  vaccinatedOn?: string | null;
}
