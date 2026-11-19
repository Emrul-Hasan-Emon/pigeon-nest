import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { MAX_INT32 } from '../../../shared/constants/limits';
import { parseBoolean } from '../../../shared/utils/transform.util';

// Multipart ids arrive as strings: a repeated field, a comma-separated
// string ("1,2") or a JSON array ("[1,2]"). Anything unparsable is left as a
// non-integer so validation rejects it.
function toIdList(value: unknown): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => Number(item));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        return (JSON.parse(trimmed) as unknown[]).map((item) => Number(item));
      } catch {
        return value;
      }
    }
    return trimmed.split(',').map((item) => Number(item.trim()));
  }
  return [Number(value)];
}

export class UpdateProductMediaFilesDto {
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  removeThumbnail?: boolean;

  @IsOptional()
  @Transform(({ value }) => toIdList(value))
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT32, { each: true })
  removeMediaFilesIds?: number[];
}
