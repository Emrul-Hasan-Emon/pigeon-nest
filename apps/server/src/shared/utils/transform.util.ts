import { TransformFnParams } from 'class-transformer';

export const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

// 'true' / 'false' only — anything else is left as-is so IsBoolean rejects it.
export const parseBoolean = ({ value }: TransformFnParams): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

// Multipart / query values: a blank string means "not provided".
export const emptyToUndefined = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() || undefined : value;

// Multipart update bodies cannot send null, so a blank string clears the field.
export const emptyToNull = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() || null : value;
