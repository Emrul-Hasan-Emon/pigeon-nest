import { ValidateIf } from 'class-validator';

// Optional like @IsOptional(), but `null` is validated (and rejected by the
// type validators) instead of silently skipped. Use for non-nullable fields.
export const IsDefinedWhenPresent = () =>
  ValidateIf((_object, value) => value !== undefined);
