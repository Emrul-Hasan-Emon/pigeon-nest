/**
 * Money is stored and calculated as a double. Binary floating point makes sums such as 0.1 + 0.2 come out as
 * 0.30000000000000004, so every result is rounded to 2 decimals before it is stored, compared or returned.
 * Amounts sent by callers are limited to 2 decimals by the request validation.
 */
const SCALE = 100;

// Round half away from zero to 2 decimals. `toPrecision(15)` first strips the binary noise, so 1.005 (stored as
// 1.00499999999999989...) rounds to 1.01 like a person and like PostgreSQL's round(numeric, 2) does.
export const tidy = (n: number): number => Math.sign(n) * Math.round(Number((Math.abs(n) * SCALE).toPrecision(15))) / SCALE;

/** True when two money values are the same after tidying. */
export const sameMoney = (a: number, b: number): boolean => tidy(a) === tidy(b);

/** `a > b`, ignoring floating point noise. */
export const moneyGreater = (a: number, b: number): boolean => tidy(a) - tidy(b) > 1e-9;
