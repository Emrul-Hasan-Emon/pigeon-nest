'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

const DEFAULT_COUNTRY: CountryCode = 'US';

const noopSubscribe = () => () => undefined;
/** false during SSR/hydration, true afterwards (no setState-in-effect needed). */
function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

function countryName(code: CountryCode): string {
  return regionNames?.of(code) ?? code;
}

/**
 * International phone field: a country dropdown plus the national number.
 * Reports the number in E.164 (e.g. +14155552671) once it is valid, or an
 * empty string while it is incomplete/invalid.
 */
export function PhoneInput({
  id,
  defaultValue = '',
  onChange,
  disabled,
  required,
}: {
  id?: string;
  /** Initial E.164 value, e.g. an existing seller phone. */
  defaultValue?: string;
  onChange: (e164: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const initial = useMemo(() => parsePhoneNumberFromString(defaultValue), [defaultValue]);
  const [country, setCountry] = useState<CountryCode>(initial?.country ?? DEFAULT_COUNTRY);
  const [national, setNational] = useState(initial?.nationalNumber ?? '');
  const [touched, setTouched] = useState(false);
  const hydrated = useHydrated();

  // Country names come from Intl, which differs between server and browser, so
  // the full list renders only after hydration (just the selection before).
  const countries = useMemo(
    () =>
      (hydrated ? getCountries() : [country])
        .map((code) => ({ code, name: countryName(code), dial: getCountryCallingCode(code) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hydrated],
  );

  function emit(nextCountry: CountryCode, nextNational: string) {
    const parsed = parsePhoneNumberFromString(nextNational, nextCountry);
    onChange(parsed?.isValid() ? parsed.number : '');
  }

  const parsed = national ? parsePhoneNumberFromString(national, country) : undefined;
  const invalid = touched && national.length > 0 && !parsed?.isValid();

  return (
    <div>
      <div className="flex gap-2">
        <select
          aria-label="Country"
          value={country}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value as CountryCode;
            setCountry(next);
            emit(next, national);
          }}
          className="w-44 shrink-0 rounded-md border border-input bg-card px-2 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} (+{c.dial})
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="Phone number"
          required={required}
          disabled={disabled}
          value={national}
          onBlur={() => setTouched(true)}
          onChange={(event) => {
            const value = event.target.value.replace(/[^\d\s-]/g, '');
            setNational(value);
            emit(country, value);
          }}
          className={`min-w-0 flex-1 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none ${
            invalid ? 'border-destructive' : 'border-input'
          }`}
        />
      </div>
      {invalid && (
        <p className="mt-1 text-xs text-destructive">
          Enter a valid {countryName(country)} phone number.
        </p>
      )}
    </div>
  );
}
