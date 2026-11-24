import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { emptyToNull, parseBoolean } from '../../../shared/utils/transform.util';

// Multipart body: name, ringNumber, removeImage, and an `image` file.
// A field left out stays as it is; a blank name or ringNumber clears it.
export class SaveSkuParentDto {
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  name?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(60)
  ringNumber?: string | null;

  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  removeImage?: boolean;
}
