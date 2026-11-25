import { parsePhoneNumberFromString } from 'libphonenumber-js';

export const PHONE_FORMAT_MESSAGE =
  'phone must be a valid international number including the country code, e.g. +14155552671';

// Canonical E.164 ("+14155552671") for a valid international number, or
// null. Spaces/dashes are tolerated; a missing "+country code" is not.
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith('+')) {
    return null;
  }
  const parsed = parsePhoneNumberFromString(trimmed);
  return parsed?.isValid() ? parsed.number : null;
}
