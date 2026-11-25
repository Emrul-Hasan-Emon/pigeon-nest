// The one place that decides how money looks. The marketplace sells in US dollars for now.
// If another currency is ever allowed, change this file and pass the row's `currency` in.
export const CURRENCY = 'USD';
export const CURRENCY_SYMBOL = '$';

/** Round to whole cents, so sums like 0.1 + 0.2 do not show as 0.30000000000000004. Use after any money arithmetic. */
export function roundMoney(n: number): number {
  return Math.sign(n) * Math.round(Number((Math.abs(n) * 100).toPrecision(15))) / 100;
}

/** A number with thousands separators and always 2 decimals (cents), no symbol: 1,250.50 */
export function plainMoney(n: number | string): string {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** An amount with the currency symbol: $1,250.50 */
export function formatMoney(n: number | string): string {
  return `${CURRENCY_SYMBOL}${plainMoney(n)}`;
}
