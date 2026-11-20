import { getCountries } from 'libphonenumber-js';

const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

/** Every country as ISO 3166-1 alpha-2 code and English name, sorted by name. */
export const COUNTRIES: { code: string; name: string }[] = getCountries()
  .map((code) => ({ code: code as string, name: regionNames?.of(code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const countryNameOf = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;
